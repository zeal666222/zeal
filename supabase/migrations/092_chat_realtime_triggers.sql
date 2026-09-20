-- 092_chat_realtime_triggers.sql
CREATE OR REPLACE FUNCTION public.broadcast_message_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p RECORD;
BEGIN
  PERFORM realtime.broadcast_changes('room:' || NEW."conversationId"::text || ':messages', TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  FOR p IN SELECT "userId" FROM public."ConversationParticipant" WHERE "conversationId" = NEW."conversationId" LOOP
    PERFORM realtime.broadcast_changes('user:' || p."userId"::text || ':inbox', TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'broadcast_message_changes: %', SQLERRM; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_broadcast_message ON public."Message";
CREATE TRIGGER trg_broadcast_message AFTER INSERT ON public."Message" FOR EACH ROW EXECUTE FUNCTION public.broadcast_message_changes();

CREATE OR REPLACE FUNCTION public.broadcast_wallet_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM realtime.broadcast_changes('user:' || NEW."userId"::text || ':wallet', TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'broadcast_wallet_changes: %', SQLERRM; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_broadcast_wallet ON public."Wallet";
CREATE TRIGGER trg_broadcast_wallet AFTER UPDATE ON public."Wallet" FOR EACH ROW EXECUTE FUNCTION public.broadcast_wallet_changes();

CREATE OR REPLACE FUNCTION public.broadcast_ledger_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner_id text;
BEGIN
  SELECT "userId"::text INTO owner_id FROM public."Wallet" WHERE id = NEW."walletId";
  IF owner_id IS NULL THEN RETURN NEW; END IF;
  PERFORM realtime.broadcast_changes('user:' || owner_id || ':wallet:ledger', TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'broadcast_ledger_entry: %', SQLERRM; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_broadcast_ledger_entry ON public."Transaction";
CREATE TRIGGER trg_broadcast_ledger_entry AFTER INSERT ON public."Transaction" FOR EACH ROW EXECUTE FUNCTION public.broadcast_ledger_entry();

CREATE OR REPLACE FUNCTION public.process_per_minute_deduction(p_user_id text, p_consultant_id text, p_amount double precision, p_session_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ref text; v_existing "Transaction"%ROWTYPE; v_uw "Wallet"%ROWTYPE; v_cw "Wallet"%ROWTYPE; v_consultant "Consultant"%ROWTYPE; v_fee double precision; v_earning double precision;
BEGIN
  v_ref := 'permin:' || p_session_id || ':' || to_char(now(), 'YYYYMMDDHH24MI');
  SELECT * INTO v_existing FROM "Transaction" WHERE "referenceId" = v_ref FOR UPDATE;
  IF FOUND THEN RETURN jsonb_build_object('success', true, 'idempotent', true, 'transactionId', v_existing.id); END IF;
  SELECT * INTO v_uw FROM "Wallet" WHERE "userId" = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_uw.balance < p_amount THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds'); END IF;
  v_fee := p_amount * 0.20; v_earning := p_amount - v_fee;
  SELECT * INTO v_consultant FROM "Consultant" WHERE id = p_consultant_id FOR UPDATE;
  SELECT * INTO v_cw FROM "Wallet" WHERE "userId" = v_consultant."userId" FOR UPDATE;
  UPDATE "Wallet" SET balance = balance - p_amount, "updatedAt" = now() WHERE id = v_uw.id;
  UPDATE "Wallet" SET balance = balance + v_earning, "updatedAt" = now() WHERE id = v_cw.id;
  UPDATE "Consultant" SET earnings = earnings + v_earning, "updatedAt" = now() WHERE id = p_consultant_id;
  INSERT INTO "Transaction" (id, "walletId", type, amount, balance, description, "referenceId") VALUES (gen_random_uuid()::text, v_uw.id, 'PAYMENT', -p_amount, v_uw.balance - p_amount, 'Per-minute billing', v_ref);
  INSERT INTO "Transaction" (id, "walletId", type, amount, balance, description, "referenceId") VALUES (gen_random_uuid()::text, v_cw.id, 'COMMISSION', v_earning, v_cw.balance + v_earning, 'Per-minute earning', v_ref || ':earn');
  RETURN jsonb_build_object('success', true, 'idempotent', false, 'remaining', v_uw.balance - p_amount);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'code', SQLSTATE);
END; $$;
GRANT EXECUTE ON FUNCTION public.process_per_minute_deduction TO authenticated;
NOTIFY pgrst, 'reload schema';
