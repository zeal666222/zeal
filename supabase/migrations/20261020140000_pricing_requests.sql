-- ═══════════════════════════════════════════════════════════════════════════════
-- 20261020140000_pricing_requests.sql
-- The consultant pricing screen (self-service rate change requests) and the
-- super-admin "Pricing Requests" approval queue both target a table
-- ("PricingChangeRequest") and RPCs (request/approve/reject_pricing_change)
-- that were referenced by app code but NEVER created in any migration — the
-- 1000_cleanup file even lists them as "kept via RPCs". Result: consultant POST
-- returned "Failed" and the admin screen 404'd on GET and POST. This creates
-- the schema + the three RPCs so the whole workflow works end to end.
--
-- Idempotent + additive. Apply with `supabase db push`.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public."PricingChangeRequest" (
  id               TEXT PRIMARY KEY DEFAULT ('pr_' || replace(gen_random_uuid()::text, '-', '')),
  "consultantId"   UUID NOT NULL REFERENCES public."Consultant"(id) ON DELETE CASCADE,
  "requestedBy"    UUID NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  "requestedRates" JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason           TEXT,
  status           TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | REJECTED | CANCELLED
  note             TEXT,
  "reviewedBy"     UUID REFERENCES public."User"(id),
  "reviewedAt"     TIMESTAMPTZ,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pcr_consultant ON public."PricingChangeRequest"("consultantId");
CREATE INDEX IF NOT EXISTS idx_pcr_status     ON public."PricingChangeRequest"(status, "createdAt" DESC);

-- Direct access is service-role only (both routes read/write via the admin
-- client); RLS with no policies denies anon/authenticated table access.
ALTER TABLE public."PricingChangeRequest" ENABLE ROW LEVEL SECURITY;

-- ── request_pricing_change: consultant files a new rate-change request ─────────
-- Runs via the service-role client (auth.uid() is NULL there), so it takes the
-- consultantId explicitly and resolves the requester from Consultant.userId.
CREATE OR REPLACE FUNCTION public.request_pricing_change(
  p_consultant_id uuid,
  p_requested     jsonb,
  p_reason        text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE v_by uuid; v_id text; rec public."PricingChangeRequest";
BEGIN
  IF p_consultant_id IS NULL OR p_requested IS NULL OR p_requested = '{}'::jsonb THEN
    RETURN jsonb_build_object('success', false, 'error', 'No rates requested');
  END IF;

  SELECT "userId" INTO v_by FROM public."Consultant" WHERE id = p_consultant_id;
  IF v_by IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Consultant not found');
  END IF;

  -- Only one live request per consultant: retire any earlier PENDING one.
  UPDATE public."PricingChangeRequest"
     SET status = 'CANCELLED', "updatedAt" = now()
   WHERE "consultantId" = p_consultant_id AND status = 'PENDING';

  INSERT INTO public."PricingChangeRequest"
    ("consultantId", "requestedBy", "requestedRates", reason, status)
    VALUES (p_consultant_id, v_by, p_requested, coalesce(p_reason, ''), 'PENDING')
  RETURNING * INTO rec;

  PERFORM public.safe_broadcast('admin:pricing', 'INSERT', 'PricingChangeRequest', 'public', to_jsonb(rec), NULL);
  RETURN jsonb_build_object('success', true, 'id', rec.id);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.request_pricing_change(uuid, jsonb, text) TO authenticated, service_role;

-- ── approve_pricing_change: admin applies the requested rates ──────────────────
CREATE OR REPLACE FUNCTION public.approve_pricing_change(
  p_request_id text,
  p_note       text,
  p_actor_id   uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE r public."PricingChangeRequest";
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."User" WHERE id = p_actor_id
                 AND upper(coalesce(role,'USER')) IN ('SUPER_ADMIN','ADMIN','SUPPORT')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO r FROM public."PricingChangeRequest" WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  IF r.status <> 'PENDING' THEN RETURN jsonb_build_object('success', false, 'error', 'already_processed'); END IF;

  -- Apply only the whitelisted rate columns; unknown keys are ignored.
  UPDATE public."Consultant" SET
    "perMinuteRate" = COALESCE((r."requestedRates" ->> 'perMinuteRate')::float, "perMinuteRate"),
    "chatRate"      = COALESCE((r."requestedRates" ->> 'chatRate')::float,      "chatRate"),
    "audioRate"     = COALESCE((r."requestedRates" ->> 'audioRate')::float,     "audioRate"),
    "videoRate"     = COALESCE((r."requestedRates" ->> 'videoRate')::float,     "videoRate"),
    "physicalRate"  = COALESCE((r."requestedRates" ->> 'physicalRate')::float,  "physicalRate")
  WHERE id = r."consultantId";

  UPDATE public."PricingChangeRequest"
     SET status = 'APPROVED', note = p_note, "reviewedBy" = p_actor_id,
         "reviewedAt" = now(), "updatedAt" = now()
   WHERE id = p_request_id
  RETURNING * INTO r;

  PERFORM public.safe_broadcast('admin:pricing', 'UPDATE', 'PricingChangeRequest', 'public', to_jsonb(r), NULL);
  RETURN jsonb_build_object('success', true);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.approve_pricing_change(text, text, uuid) TO authenticated, service_role;

-- ── reject_pricing_change: admin declines with a reason ────────────────────────
CREATE OR REPLACE FUNCTION public.reject_pricing_change(
  p_request_id text,
  p_reason     text,
  p_actor_id   uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE r public."PricingChangeRequest";
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."User" WHERE id = p_actor_id
                 AND upper(coalesce(role,'USER')) IN ('SUPER_ADMIN','ADMIN','SUPPORT')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO r FROM public."PricingChangeRequest" WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  IF r.status <> 'PENDING' THEN RETURN jsonb_build_object('success', false, 'error', 'already_processed'); END IF;

  UPDATE public."PricingChangeRequest"
     SET status = 'REJECTED', note = p_reason, "reviewedBy" = p_actor_id,
         "reviewedAt" = now(), "updatedAt" = now()
   WHERE id = p_request_id
  RETURNING * INTO r;

  PERFORM public.safe_broadcast('admin:pricing', 'UPDATE', 'PricingChangeRequest', 'public', to_jsonb(r), NULL);
  RETURN jsonb_build_object('success', true);
END;
$func$;
GRANT EXECUTE ON FUNCTION public.reject_pricing_change(text, text, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
