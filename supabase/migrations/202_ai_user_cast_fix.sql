-- 202_ai_user_cast_fix.sql — safe AI shadow-user provisioning
BEGIN;

CREATE OR REPLACE FUNCTION public.ensure_ai_user(p_ai_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid; v_ai record;
BEGIN
  BEGIN v_uid := p_ai_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_uid := ('00000000-0000-0000-0000-' || LPAD(SUBSTRING(MD5(p_ai_id), 1, 12), 12, '0'))::uuid;
  END;

  SELECT * INTO v_ai FROM public."AIConsultant" WHERE id = p_ai_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  INSERT INTO public."User" (id, email, username, name, avatar_url, role, "isVerified", is_online)
  VALUES (v_uid, COALESCE(v_ai.username, 'ai_' || LEFT(v_uid::text, 8)) || '@ai.zeal.local',
          COALESCE(v_ai.username, 'ai_' || LEFT(v_uid::text, 8)),
          v_ai.name, v_ai.avatar, 'AI'::"AppRole", true, true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public."Wallet" ("userId", balance) VALUES (v_uid, 0)
  ON CONFLICT ("userId") DO NOTHING;

  RETURN v_uid;
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_ai_user(text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
