-- ═══════════════════════════════════════════════════════════════════════════════
-- 20261020140000_pricing_requests.sql
--
-- Consultant self-service rate changes + the super-admin "Pricing Requests"
-- queue. A live-schema probe found the truth behind the dead buttons:
--
--   * The table and all three RPCs already exist in prod (created outside the
--     migration history, like ~25 other live tables). So this file must MATCH
--     that shape, not invent a new one: id is `uuid DEFAULT gen_random_uuid()`,
--     there is no `note` column, `reason` carries CHECK (length >= 30), and
--     status is limited to PENDING/APPROVED/REJECTED/WITHDRAWN.
--   * All three deployed functions gate on auth.uid() / auth_is_admin(). Both
--     routes call them with the service-role client, where auth.uid() is always
--     NULL, so every call returned not_authenticated: the consultant POST said
--     "Failed" and the admin Approve/Reject did nothing.
--   * Worse, the admin route passes p_actor_id, which the deployed 2-argument
--     functions do not accept → PGRST202 "could not find the function".
--   * All three are granted to anon. Their auth.uid() gate was the only thing
--     standing between an anonymous internet caller and an admin-only mutation;
--     once an explicit actor parameter exists that gate disappears, so anon must
--     be revoked here in the same breath.
--
-- The new overloads keep every behaviour prod already has (rate snapshot,
-- numeric range validation, RateChangeLog audit rows, requester Notification,
-- FOR UPDATE row locking) and add: an explicit vetted actor, a real role check
-- read from "User".role instead of auth_is_admin(), admin:pricing broadcasts for
-- the realtime queue, and an error envelope that reports SQLSTATE without
-- echoing raw database internals to the client.
--
-- Idempotent + additive: the deployed functions stay in place for any other
-- caller. p_actor_id is deliberately REQUIRED, not DEFAULT NULL: a trailing
-- default makes the old and new overload positionally indistinguishable
-- ("function request_pricing_change(uuid, jsonb, unknown) is not unique"), and
-- an ambiguous call is a dead button again. Both routes pass the actor. Apply with
-- `supabase db query --linked -f supabase/migrations/20261020140000_pricing_requests.sql`.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public."PricingChangeRequest" (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "consultantId"   UUID NOT NULL REFERENCES public."Consultant"(id) ON DELETE CASCADE,
  "requestedBy"    UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  "currentRates"   JSONB NOT NULL DEFAULT '{}'::jsonb,
  "requestedRates" JSONB NOT NULL,
  reason           TEXT NOT NULL CHECK (length(reason) >= 30),
  status           TEXT NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING','APPROVED','REJECTED','WITHDRAWN')),
  "reviewedBy"     UUID REFERENCES public."User"(id) ON DELETE SET NULL,
  "reviewedAt"     TIMESTAMPTZ,
  "rejectionReason" TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill for any environment where this table exists with an older, narrower
-- shape; a no-op against prod.
ALTER TABLE public."PricingChangeRequest" ADD COLUMN IF NOT EXISTS "currentRates"    JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public."PricingChangeRequest" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

CREATE INDEX IF NOT EXISTS idx_pcr_consultant ON public."PricingChangeRequest"("consultantId");
CREATE INDEX IF NOT EXISTS idx_pcr_status     ON public."PricingChangeRequest"(status, "createdAt" DESC);

-- Both routes read this table through the service-role client (which bypasses
-- RLS), so no policy is needed; enabling it just keeps anon/authenticated out.
ALTER TABLE public."PricingChangeRequest" ENABLE ROW LEVEL SECURITY;

-- ── request_pricing_change: consultant files a rate-change request ─────────────
CREATE OR REPLACE FUNCTION public.request_pricing_change(
  p_consultant_id uuid,
  p_requested     jsonb,
  p_reason        text,
  p_actor_id      uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid     uuid := auth.uid();
  v_caller  uuid;
  v_consult record;
  v_req     record;
  v_key     text;
  v_val     text;
BEGIN
  IF p_consultant_id IS NULL OR p_requested IS NULL OR p_requested = '{}'::jsonb THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_rates_requested');
  END IF;

  SELECT * INTO v_consult FROM public."Consultant" WHERE id = p_consultant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'consultant_not_found');
  END IF;

  -- A session caller may only file for their own consultant profile, and may
  -- not file on behalf of someone else. With no session (the service-role
  -- route, which resolves userId -> consultant before calling) the requester
  -- is taken from the consultant row itself.
  IF v_uid IS NOT NULL AND (v_consult."userId" <> v_uid
                             OR COALESCE(p_actor_id, v_uid) <> v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_caller := COALESCE(p_actor_id, v_uid, v_consult."userId");
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- One live request per consultant: filing twice would let two approvals race.
  IF EXISTS (SELECT 1 FROM public."PricingChangeRequest"
              WHERE "consultantId" = p_consultant_id AND status = 'PENDING') THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_pending');
  END IF;

  IF length(COALESCE(p_reason, '')) < 30 THEN
    RETURN jsonb_build_object('success', false, 'error', 'reason_too_short');
  END IF;

  -- Only the five rate fields are meaningful, and each must be a plain positive
  -- number: a text value here would abort the whole call on cast.
  FOR v_key IN SELECT jsonb_object_keys(p_requested) LOOP
    IF v_key NOT IN ('perMinuteRate','chatRate','audioRate','videoRate','physicalRate') THEN
      CONTINUE;
    END IF;
    v_val := trim(p_requested ->> v_key);
    IF v_val !~ '^[0-9]+(\.[0-9]+)?$' OR v_val::numeric NOT BETWEEN 10 AND 5000 THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_rate_' || v_key);
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM jsonb_object_keys(p_requested) k
                  WHERE k IN ('perMinuteRate','chatRate','audioRate','videoRate','physicalRate')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_rates_requested');
  END IF;

  INSERT INTO public."PricingChangeRequest" (
    "consultantId", "requestedBy", "currentRates", "requestedRates", reason
  ) VALUES (
    p_consultant_id, v_caller,
    jsonb_build_object(
      'perMinuteRate', v_consult."perMinuteRate",
      'chatRate',      v_consult."chatRate",
      'audioRate',     v_consult."audioRate",
      'videoRate',     v_consult."videoRate",
      'physicalRate',  v_consult."physicalRate"
    ),
    p_requested, p_reason
  )
  RETURNING * INTO v_req;

  PERFORM public.safe_broadcast('admin:pricing', 'INSERT', 'PricingChangeRequest',
                                'public', to_jsonb(v_req), NULL);
  RETURN jsonb_build_object('success', true, 'requestId', v_req.id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'internal_error', 'code', SQLSTATE);
END;
$func$;

-- ── approve_pricing_change: admin applies the requested rates ─────────────────
CREATE OR REPLACE FUNCTION public.approve_pricing_change(
  p_request_id uuid,
  p_note       text,
  p_actor_id   uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_actor uuid := COALESCE(p_actor_id, auth.uid());
  v_role  text;
  v_req   record;
  v_field text;
  v_val   text;
  v_old   numeric;
  v_new   numeric;
BEGIN
  SELECT role::text INTO v_role FROM public."User" WHERE id = v_actor;
  IF v_role IS NULL OR v_role NOT IN ('SUPER_ADMIN','ADMIN','SUPPORT') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_req FROM public."PricingChangeRequest"
   WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_found');
  END IF;
  IF v_req.status <> 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_pending');
  END IF;

  FOR v_field IN SELECT jsonb_object_keys(v_req."requestedRates") LOOP
    IF v_field NOT IN ('perMinuteRate','chatRate','audioRate','videoRate','physicalRate') THEN
      CONTINUE;
    END IF;
    -- Rows filed before this function existed can hold junk; skip rather than
    -- abort the whole approval on one bad field.
    v_val := trim(v_req."requestedRates" ->> v_field);
    IF v_val IS NULL OR v_val !~ '^[0-9]+(\.[0-9]+)?$' THEN
      CONTINUE;
    END IF;
    v_new := v_val::numeric;
    v_old := CASE WHEN v_req."currentRates" ->> v_field ~ '^[0-9]+(\.[0-9]+)?$'
                  THEN (v_req."currentRates" ->> v_field)::numeric ELSE 0 END;

    EXECUTE format('UPDATE public."Consultant" SET %I = $1 WHERE id = $2', v_field)
      USING v_new, v_req."consultantId";

    INSERT INTO public."RateChangeLog" (
      "targetType", "targetId", field, "oldValue", "newValue", "changedBy", reason, "requestId"
    ) VALUES (
      'CONSULTANT', v_req."consultantId", v_field, v_old, v_new,
      v_actor, COALESCE(NULLIF(trim(p_note), ''), 'Approved request ' || p_request_id), p_request_id
    );
  END LOOP;

  UPDATE public."PricingChangeRequest"
     SET status = 'APPROVED', "reviewedBy" = v_actor,
         "reviewedAt" = now(), "updatedAt" = now()
   WHERE id = p_request_id
  RETURNING * INTO v_req;

  INSERT INTO public."Notification" ("userId", type, message, "redirectUrl", "actorId")
  VALUES (
    v_req."requestedBy", 'system',
    'Your pricing change request was approved.', '/consultant/settings', v_actor
  );

  PERFORM public.safe_broadcast('admin:pricing', 'UPDATE', 'PricingChangeRequest',
                                'public', to_jsonb(v_req), NULL);
  RETURN jsonb_build_object('success', true, 'status', v_req.status,
                            'consultantId', v_req."consultantId");
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'internal_error', 'code', SQLSTATE);
END;
$func$;

-- ── reject_pricing_change: admin declines with a reason ───────────────────────
CREATE OR REPLACE FUNCTION public.reject_pricing_change(
  p_request_id uuid,
  p_reason     text,
  p_actor_id   uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_actor uuid := COALESCE(p_actor_id, auth.uid());
  v_role  text;
  v_req   record;
BEGIN
  SELECT role::text INTO v_role FROM public."User" WHERE id = v_actor;
  IF v_role IS NULL OR v_role NOT IN ('SUPER_ADMIN','ADMIN','SUPPORT') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF length(COALESCE(p_reason, '')) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'reason_too_short');
  END IF;

  SELECT * INTO v_req FROM public."PricingChangeRequest"
   WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_found');
  END IF;
  IF v_req.status <> 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_pending');
  END IF;

  UPDATE public."PricingChangeRequest"
     SET status = 'REJECTED', "reviewedBy" = v_actor, "reviewedAt" = now(),
         "rejectionReason" = trim(p_reason), "updatedAt" = now()
   WHERE id = p_request_id
  RETURNING * INTO v_req;

  INSERT INTO public."Notification" ("userId", type, message, "redirectUrl", "actorId")
  VALUES (
    v_req."requestedBy", 'system',
    'Your pricing change request was rejected: ' || trim(p_reason),
    '/consultant/settings', v_actor
  );

  PERFORM public.safe_broadcast('admin:pricing', 'UPDATE', 'PricingChangeRequest',
                                'public', to_jsonb(v_req), NULL);
  RETURN jsonb_build_object('success', true, 'status', v_req.status);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'internal_error', 'code', SQLSTATE);
END;
$func$;

-- Postgres created these functions with EXECUTE granted to PUBLIC, and the
-- deployed ones also carry an explicit `anon=X` entry: a REVOKE aimed at one
-- grantee leaves the other alone, so both have to go. Strip PUBLIC and anon from
-- every overload (deployed signatures included), then hand EXECUTE back to
-- exactly the two roles that need it.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('request_pricing_change','approve_pricing_change','reject_pricing_change')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role',
                   r.proname, r.args);
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
