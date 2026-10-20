-- ============================================================================
-- 20261020160000_rpc_alignment.sql
--
-- Why: a live-schema probe (PostgREST schema cache) found that production
-- carries only the narrow 0000-era overloads for these functions, while the app
-- calls the wider ones. PostgREST resolves .rpc() by *named* arguments, so every
-- call below currently fails with PGRST202 ("could not find the function") and
-- these user-visible flows are dead in prod:
--   * consultant verification  (admin queue: Approve/Reject do nothing)
--   * quest / sparks claiming  (the 1-arg version writes an activity row but
--                               credits nothing, so the Sparks loop pays zero)
--   * cheer toggle             (falls back to not_authenticated whenever the
--                               caller is the service-role client, auth.uid() NULL)
--
-- Additive: these are NEW overloads with different parameter names, so the
-- existing 0000 functions stay intact for any other caller. Idempotent — safe to
-- run twice.
--
-- Also closes an anonymous API-key oracle found by the same probe.
-- ============================================================================

-- ─── 1. verify_consultant: explicit actor, no auth.uid() dependency ──────────
-- The live 1-arg version gates on auth_is_admin(), which reads auth.uid(). The
-- admin route calls it with the service-role key, where auth.uid() is always
-- NULL, so verification can never succeed from the admin panel.
--
-- Status strings follow the convention the app already uses
-- (app/actions/admin.ts, admin/(portal)/consultants filter dropdown):
-- PENDING -> VERIFIED | REJECTED, never "APPROVED".
CREATE OR REPLACE FUNCTION public.verify_consultant(
  p_consultant_id uuid,
  p_admin_id      uuid,
  p_action        text,
  p_reason        text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_actor_role text;
  v_target     record;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('APPROVE','REJECT') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_action');
  END IF;

  -- Defense in depth: the named actor must really hold an admin role, whatever
  -- the caller claims. role is the "AppRole" enum, hence the ::text.
  SELECT role::text INTO v_actor_role FROM public."User" WHERE id = p_admin_id;
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('ADMIN','SUPER_ADMIN') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_target FROM public."Consultant" WHERE id = p_consultant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'consultant_not_found');
  END IF;

  IF p_action = 'APPROVE' THEN
    UPDATE public."Consultant"
       SET "isVerified" = true, status = 'VERIFIED', "updatedAt" = now()
     WHERE id = p_consultant_id;
    UPDATE public."User"
       SET "isVerified" = true, "updatedAt" = now()
     WHERE id = v_target."userId";
  ELSE
    UPDATE public."Consultant"
       SET "isVerified" = false, status = 'REJECTED', "updatedAt" = now()
     WHERE id = p_consultant_id;
    UPDATE public."User"
       SET "isVerified" = false, "updatedAt" = now()
     WHERE id = v_target."userId";
  END IF;

  -- "Consultant" has no notes column, so the decision is delivered where the
  -- applicant can actually read it: their notification feed. The admin's audit
  -- trail is written by the route (AdminAuditLog).
  INSERT INTO public."Notification" ("userId", type, message, "redirectUrl", "actorId")
  VALUES (
    v_target."userId",
    'verification',
    CASE
      WHEN p_action = 'APPROVE'
        THEN 'Your consultant application was approved. You are live and can take bookings.'
        WHEN COALESCE(trim(p_reason), '') = ''
          THEN 'Your consultant application was not approved. Update your profile and reapply.'
          ELSE 'Your consultant application was not approved. Reason: ' || trim(p_reason)
    END,
    '/consultant/onboarding',
    p_admin_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'action',  p_action,
    'userId',  v_target."userId",
    'status',  CASE WHEN p_action = 'APPROVE' THEN 'VERIFIED' ELSE 'REJECTED' END
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.verify_consultant(uuid, uuid, text, text) TO authenticated, service_role;

-- ─── 2. claim_quest: actually award the reward, idempotently ─────────────────
-- Live shape is claim_quest(text): no credits, and its "idempotency" is an
-- ON CONFLICT DO NOTHING against a table with no matching constraint, so it
-- inserts forever. The reward used to come from the request body unchecked.
CREATE OR REPLACE FUNCTION public.claim_quest(
  p_quest_id text,
  p_user_id  uuid,
  p_reward   int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid      uuid := auth.uid();
  v_reward   int  := GREATEST(0, LEAST(COALESCE(p_reward, 0), 500));
  v_total    int;
BEGIN
  IF COALESCE(p_quest_id, '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_quest');
  END IF;

  -- A session caller may only claim for themselves; the service-role client
  -- (auth.uid() IS NULL) is already behind an auth guard in the route.
  IF v_uid IS NOT NULL AND v_uid <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_your_quest');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public."User" WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  -- Serialise claims for this (user, quest) pair for the length of the
  -- transaction, so a double tap cannot read "not claimed" twice and pay twice.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_quest_id, 0));

  IF EXISTS (
    SELECT 1 FROM public."UserActivity"
     WHERE "userId" = p_user_id
       AND type = 'quest_claim'
       AND metadata->>'questId' = p_quest_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'alreadyClaimed', true, 'awarded', 0,
                              'sparks', (SELECT sparks FROM public."User" WHERE id = p_user_id));
  END IF;

  INSERT INTO public."UserActivity" ("userId", type, metadata)
  VALUES (p_user_id, 'quest_claim',
          jsonb_build_object('questId', p_quest_id, 'reward', v_reward, 'claimed_at', now()));

  UPDATE public."User"
     SET sparks = sparks + v_reward,
         "sparkScore" = "sparkScore" + v_reward,
         "updatedAt" = now()
   WHERE id = p_user_id
  RETURNING sparks INTO v_total;

  RETURN jsonb_build_object('success', true, 'alreadyClaimed', false,
                            'awarded', v_reward, 'sparks', v_total);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.claim_quest(text, uuid, int) TO authenticated, service_role;

-- ─── 3. toggle_cheer: explicit actor, self-healing count ────────────────────
CREATE OR REPLACE FUNCTION public.toggle_cheer(
  p_post_id uuid,
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid   uuid := auth.uid();
  v_new   uuid;
  v_count int;
BEGIN
  IF v_uid IS NOT NULL AND v_uid <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  -- A cheer must point at a real post; the 0000 version could orphan rows.
  IF NOT EXISTS (SELECT 1 FROM public."Post" WHERE id = p_post_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'post_not_found');
  END IF;

  INSERT INTO public."Cheer" ("postId", "userId")
  VALUES (p_post_id, p_user_id)
  ON CONFLICT ("postId", "userId") DO NOTHING
  RETURNING id INTO v_new;

  -- Recomputed rather than incremented/decremented: concurrent toggles (and the
  -- old function's unguarded maths) can leave cheerCount adrift.
  IF v_new IS NULL THEN
    DELETE FROM public."Cheer" WHERE "postId" = p_post_id AND "userId" = p_user_id;
  END IF;

  UPDATE public."Post"
     SET "cheerCount" = (SELECT count(*)::int FROM public."Cheer" WHERE "postId" = p_post_id),
         "updatedAt"  = now()
   WHERE id = p_post_id
  RETURNING "cheerCount" INTO v_count;

  RETURN jsonb_build_object('success', true, 'cheered', v_new IS NOT NULL, 'cheers', v_count);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.toggle_cheer(uuid, uuid) TO authenticated, service_role;

-- ─── 4. Close the anonymous API-key oracle ──────────────────────────────────
-- The 0000 build granted validate_admin_api_key(text) to anon: anyone on the
-- internet could POST /rpc/validate_admin_api_key and use the yes/no answer as a
-- key-hash oracle. It is a service-role-only operation.
REVOKE ALL ON FUNCTION public.validate_admin_api_key(text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.validate_admin_api_key(text) TO service_role;
