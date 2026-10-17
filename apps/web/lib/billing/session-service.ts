// apps/web/lib/billing/session-service.ts
// Server-authoritative per-minute billing. Escrow released on end.
import "server-only";
import { createAdminClient } from "@zeal/database/server";
import {
  MIN_START_MINUTES,
  LOW_BALANCE_THRESHOLD_MINUTES,
  MAX_SESSION_DURATION_MINUTES,
  type BillingSession,
  type HeartbeatResult,
  type SessionEndResult,
  type SessionStartResult,
  type WalletState,
} from "./types";
import { withSessionLock } from "./concurrency";
import { publishWalletBalance } from "@/lib/realtime/wallet";

type Admin = ReturnType<typeof createAdminClient>;

// Per-minute debit is driven by wall-clock elapsed time. A client that closes
// its tab stops sending heartbeats but never calls endSession, so on the next
// beat `minutesElapsed - lastBilled` can span hours of idle time. Cap how many
// minutes a single heartbeat may bill and write the rest off as idle, so a
// stale/reopened session can never retroactively charge for time the user was
// away. Sized generously (3 min) so ordinary missed/delayed beats still charge.
const MAX_BILLABLE_GAP_MINUTES = 3;

async function lookupRate(
  admin: Admin,
  consultantId: string | null,
  aiConsultantId: string | null,
): Promise<{ rate: number; isAI: boolean } | null> {
  if (aiConsultantId) {
    const { data } = await admin
      .from("AIConsultant")
      .select('"perMinuteRate", "isActive", "isPaid"')
      .eq("id", aiConsultantId)
      .maybeSingle();
    if (!data) return null;
    const row = data as { perMinuteRate: number; isActive: boolean; isPaid: boolean };
    if (!row.isActive) return null;
    return { rate: row.isPaid ? Number(row.perMinuteRate ?? 0) : 0, isAI: true };
  }
  if (!consultantId) return null;
  // Canonical rate must match the gate + the displayed price: both the
  // `auto_start_chat_billing` RPC and `chat_partner_view` resolve a human's
  // per-minute rate as COALESCE(chatRate, perMinuteRate). Reading only
  // perMinuteRate here would debit a different amount than the user was quoted.
  const { data } = await admin
    .from("Consultant")
    .select('"chatRate", "perMinuteRate", "isActive"')
    .eq("id", consultantId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { chatRate: number | null; perMinuteRate: number; isActive: boolean };
  if (!row.isActive) return null;
  return { rate: Number(row.chatRate ?? row.perMinuteRate ?? 0), isAI: false };
}

async function lookupWallet(admin: Admin, userId: string): Promise<WalletState | null> {
  const { data } = await admin
    .from("Wallet")
    .select('balance, escrow, "pendingIn", "pendingOut", blocked')
    .eq("userId", userId)
    .maybeSingle();
  if (!data) return null;
  const r = data as WalletState;
  return {
    balance: Number(r.balance ?? 0),
    escrow: Number(r.escrow ?? 0),
    pendingIn: Number(r.pendingIn ?? 0),
    pendingOut: Number(r.pendingOut ?? 0),
    blocked: Number(r.blocked ?? 0),
  };
}

export async function startSession(params: {
  userId: string;
  consultantId?: string | null;
  aiConsultantId?: string | null;
  conversationId?: string | null;
}): Promise<SessionStartResult> {
  const { userId, consultantId, aiConsultantId, conversationId } = params;
  const admin = createAdminClient();

  const rateInfo = await lookupRate(admin, consultantId ?? null, aiConsultantId ?? null);
  if (!rateInfo) {
    return { success: false, error: "Consultant unavailable.", code: "NOT_CONSULTANT" };
  }
  const { rate, isAI } = rateInfo;

  if (isAI && rate === 0) {
    const nowISO = new Date().toISOString();
    const { data: session, error } = await admin
      .from("CallSession")
      .insert({
        userId,
        consultantId: null,
        aiConsultantId,
        isAI: true,
        status: "CONNECTED",
        amount: 0,
        startTime: nowISO,
        conversationId: conversationId ?? null,
        lockedRate: 0,
        lastHeartbeatAt: nowISO,
      })
      .select("id")
      .single();
    if (error || !session) {
      return { success: false, error: error?.message ?? "Insert failed", code: "INTERNAL" };
    }
    return {
      success: true,
      sessionId: (session as { id: string }).id,
      rate: 0,
      initialMinutes: 0,
      initialCharge: 0,
    };
  }

  const wallet = await lookupWallet(admin, userId);
  if (!wallet) return { success: false, error: "Wallet not found.", code: "INTERNAL" };

  const initialMinutes = MIN_START_MINUTES;
  const initialCharge = rate * initialMinutes;

  if (wallet.balance < initialCharge) {
    return {
      success: false,
      error: `Insufficient balance. Need ₹${initialCharge.toFixed(2)} for ${initialMinutes} minutes.`,
      code: "LOW_BALANCE",
    };
  }

  const referenceId = `session-start:${userId}:${Date.now()}`;
  const { data: holdData, error: holdErr } = await admin.rpc("hold_in_escrow_safe", {
    p_user_id: userId,
    p_amount: initialCharge,
    p_reference_id: referenceId,
    p_description: `Session hold — ${initialMinutes} min @ ₹${rate}/min`,
  });
  if (holdErr) return { success: false, error: holdErr.message, code: "INTERNAL" };
  const hold = holdData as { success?: boolean; error?: string } | null;
  if (hold && hold.success === false) {
    return { success: false, error: hold.error ?? "Hold failed", code: "INTERNAL" };
  }

  const now = new Date().toISOString();
  const { data: session, error: sessionErr } = await admin
    .from("CallSession")
    .insert({
      userId,
      consultantId: isAI ? null : consultantId,
      aiConsultantId: isAI ? aiConsultantId : null,
      isAI,
      status: "CONNECTED",
      amount: initialCharge,
      startTime: now,
      durationSeconds: 0,
      conversationId: conversationId ?? null,
      lockedRate: rate,
      lastHeartbeatAt: now,
    })
    .select("id")
    .single();

  if (sessionErr || !session) {
    await admin.rpc("credit_funds_safe", {
      p_user_id: userId,
      p_amount: initialCharge,
      p_description: "Session hold rollback",
      p_reference_id: `${referenceId}:rollback`,
    });
    void publishWalletBalance(userId);
    return { success: false, error: "Could not start session.", code: "INTERNAL" };
  }

  void publishWalletBalance(userId);

  return {
    success: true,
    sessionId: (session as { id: string }).id,
    rate,
    initialMinutes,
    initialCharge,
  };
}

export async function heartbeatSession(params: {
  sessionId: string;
  userId: string;
}): Promise<HeartbeatResult> {
  const { sessionId, userId } = params;

  // Wrap the entire heartbeat in an advisory lock to prevent concurrent
  // heartbeats for the same session from double-billing.
  const lockResult = await withSessionLock(sessionId, () =>
    heartbeatSessionInner(sessionId, userId),
  );

  if (!lockResult.acquired) {
    // Another heartbeat is already processing for this session.
    // Return success to avoid confusing the client — the other beat
    // will catch up on billing.
    return {
      success: true,
      sessionId,
      elapsedSeconds: 0,
      minutesBilled: 0,
      cost: 0,
      remaining: 0,
      terminate: false,
    };
  }

  if (!lockResult.success || !lockResult.result) {
    return { success: false, error: lockResult.error ?? "Heartbeat lock failed." };
  }

  return lockResult.result;
}

async function heartbeatSessionInner(
  sessionId: string,
  userId: string,
): Promise<HeartbeatResult> {
  const admin = createAdminClient();

  const { data: sessionRaw } = await admin
    .from("CallSession")
    .select('id, "userId", "consultantId", "aiConsultantId", "isAI", "startTime", "endTime", "durationSeconds", amount, status, "conversationId", "lockedRate", "lastHeartbeatAt"')
    .eq("id", sessionId)
    .eq("userId", userId)
    .maybeSingle();

  if (!sessionRaw) return { success: false, error: "Session not found." };
  const session = sessionRaw as BillingSession;

  if (session.status === "ENDED") {
    return { success: false, error: "Session ended.", terminate: true };
  }

  const startMs = new Date(session.startTime).getTime();
  const nowMs = Date.now();
  const elapsedSeconds = Math.floor((nowMs - startMs) / 1000);
  const minutesElapsed = Math.floor(elapsedSeconds / 60);

  if (minutesElapsed >= MAX_SESSION_DURATION_MINUTES) {
    const rate = session.lockedRate ?? 0;
    const lastBilled = Math.floor((session.durationSeconds ?? 0) / 60);
    const cost = lastBilled * rate;
    await admin
      .from("CallSession")
      .update({ status: "ENDED", endTime: new Date().toISOString(), durationSeconds: lastBilled * 60 })
      .eq("id", sessionId);
    return {
      success: true, sessionId, elapsedSeconds,
      minutesBilled: lastBilled, cost, remaining: 0, terminate: true,
      reason: `Maximum session duration (${MAX_SESSION_DURATION_MINUTES} min) reached.`,
    };
  }

  const rate = session.lockedRate ?? 0;
  const isAI = session.isAI;

  if (isAI && rate === 0) {
    const ws = await lookupWallet(admin, userId);
    return {
      success: true, sessionId, elapsedSeconds, minutesBilled: 0, cost: 0,
      remaining: 0, terminate: false, ...(ws ? { walletState: ws } : {}),
    };
  }

  const lastBilled = Math.floor((session.durationSeconds ?? 0) / 60);
  const gap = Math.max(0, minutesElapsed - lastBilled);
  // Charge at most a bounded catch-up window per beat; anything older is
  // treated as idle and written off below so it can never be retro-billed.
  const billable = Math.min(gap, MAX_BILLABLE_GAP_MINUTES);

  let billed = 0;
  let deductError = false;

  for (let i = 0; i < billable; i++) {
    const minuteKey = new Date(startMs + (lastBilled + i + 1) * 60_000)
      .toISOString()
      .slice(0, 16)
      .replace(/[-T:]/g, "");

    const { data: rpcData, error: rpcErr } = await admin.rpc(
      "process_per_minute_deduction",
      {
        p_user_id: userId,
        p_consultant_id: session.consultantId ?? session.aiConsultantId ?? "",
        p_amount: rate,
        p_session_id: `${sessionId}:${minuteKey}`,
        p_is_ai: session.isAI,
      },
    );

    if (rpcErr) {
      // Transient debit failure: stop and advance only past the minutes we
      // actually charged, so the failed minutes are retried on the next beat.
      console.error("[billing] minute deduct error:", rpcErr);
      deductError = true;
      break;
    }

    const result = rpcData as
      | { success?: boolean; terminate?: boolean; remaining?: number }
      | null;

    if (result && result.success === false) {
      // Out of funds mid-loop. Live sessions hold no escrow (amount=0), so a
      // direct ENDED is safe; end exactly at the minutes we could still pay.
      const endedMinutes = lastBilled + billed;
      await admin
        .from("CallSession")
        .update({
          status: "ENDED",
          endTime: new Date().toISOString(),
          durationSeconds: endedMinutes * 60,
        })
        .eq("id", sessionId);

      void publishWalletBalance(userId);

      return {
        success: true, sessionId, elapsedSeconds,
        minutesBilled: endedMinutes,
        cost: endedMinutes * rate,
        remaining: 0, terminate: true,
        reason: "Insufficient balance — session terminated.",
      };
    }

    await admin.from("BillingHeartbeat").insert({
      sessionId,
      minuteKey,
      amount: rate,
      balanceAfter: Number(result?.remaining ?? 0),
      escrowAfter: 0,
    });
    billed++;
  }

  const minutesBilled = lastBilled + billed;
  // On a transient error advance only past minutes actually charged (retry the
  // rest); otherwise advance to the current minute, writing off the idle gap.
  const newWatermark = deductError ? minutesBilled : minutesElapsed;

  const ws = await lookupWallet(admin, userId);
  const remaining = ws ? ws.balance + ws.escrow : 0;
  const minutesRemaining = rate > 0 ? Math.floor(remaining / rate) : 999;
  const terminate = minutesRemaining <= LOW_BALANCE_THRESHOLD_MINUTES;

  if (billed > 0 && ws) void publishWalletBalance(userId, ws.balance);

  const advance: Record<string, unknown> = {
    durationSeconds: newWatermark * 60,
    lastHeartbeatAt: new Date().toISOString(),
  };
  if (terminate) {
    advance.status = "ENDED";
    advance.endTime = new Date().toISOString();
  }
  await admin.from("CallSession").update(advance).eq("id", sessionId);

  return {
    success: true, sessionId, elapsedSeconds,
    minutesBilled, cost: minutesBilled * rate,
    remaining, terminate,
    reason: terminate ? `Only ${minutesRemaining} minute(s) left.` : undefined,
    ...(ws ? { walletState: ws } : {}),
  };
}

export async function endSession(params: {
  sessionId: string;
  userId: string;
  actor: "user" | "consultant" | "system";
}): Promise<SessionEndResult> {
  const { sessionId, userId } = params;
  const admin = createAdminClient();

  const { data: sessionRaw } = await admin
    .from("CallSession")
    .select('id, "userId", "consultantId", "aiConsultantId", "isAI", "startTime", "endTime", "durationSeconds", amount, status, "lockedRate"')
    .eq("id", sessionId)
    .maybeSingle();

  if (!sessionRaw) return { success: false, error: "Session not found." };
  const session = sessionRaw as BillingSession;

  if (session.userId !== userId && session.consultantId !== userId) {
    const { data: myConsultant } = await admin
      .from("Consultant")
      .select("id")
      .eq("userId", userId)
      .maybeSingle();
    const cid = (myConsultant as { id?: string } | null)?.id;
    if (!cid || session.consultantId !== cid) {
      return { success: false, error: "Not authorized to end this session." };
    }
  }

  if (session.status === "ENDED") {
    return {
      success: true, sessionId,
      durationSeconds: session.durationSeconds,
      totalCost: session.amount,
      refunded: 0,
    };
  }

  const endMs = Date.now();
  const startMs = new Date(session.startTime).getTime();
  const durationSeconds = Math.floor((endMs - startMs) / 1000);
  const durationMinutes = Math.ceil(durationSeconds / 60);

  const rate = session.lockedRate ?? 0;
  const isAI = session.isAI;

  const totalCost = durationMinutes * rate;
  // Must match the fee the money-moving `process_per_minute_deduction` RPC
  // actually credits (20%); a 10% figure here would never reconcile with the
  // ledger. This value is reporting-only — no funds move on it.
  const platformFee = totalCost * 0.20;
  const consultantEarning = totalCost - platformFee;

  const heldAmount = Number(session.amount ?? 0);

  let refunded = 0;
  if (heldAmount > 0 && !isAI) {
    const { data: relData, error: relErr } = await admin.rpc("release_session_escrow", {
      p_session_id: sessionId,
      p_held_amount: heldAmount,
      p_consumed: totalCost,
    });
    if (!relErr) {
      const rel = relData as { refunded?: number } | null;
      refunded = Number(rel?.refunded ?? 0);
    } else {
      console.error("[billing] release_session_escrow failed:", relErr);
    }
  }

  await admin
    .from("CallSession")
    .update({
      status: "ENDED",
      endTime: new Date(endMs).toISOString(),
      durationSeconds,
      amount: totalCost,
    })
    .eq("id", sessionId);

  if (refunded > 0 || (heldAmount > 0 && !isAI)) void publishWalletBalance(session.userId);

  return {
    success: true, sessionId, durationSeconds,
    totalCost, consultantEarning, platformFee, refunded,
  };
}

export async function resumeSession(params: {
  sessionId: string;
  userId: string;
}): Promise<{
  success: boolean;
  sessionId?: string;
  conversationId?: string | null;
  isAI?: boolean;
  lockedRate?: number;
  durationSeconds?: number;
  error?: string;
  ended?: boolean;
}> {
  const { sessionId, userId } = params;
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("resume_session", {
    p_user_id: userId,
    p_session_id: sessionId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const result = data as {
    success?: boolean;
    error?: string;
    ended?: boolean;
    session?: {
      id: string;
      conversationId: string | null;
      isAI: boolean;
      lockedRate: number;
      durationSeconds: number;
    };
  };

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? "Resume failed",
      ended: result.ended ?? false,
    };
  }

  const s = result.session;
  if (!s) return { success: false, error: "No session data" };

  return {
    success: true,
    sessionId: s.id,
    conversationId: s.conversationId,
    isAI: s.isAI,
    lockedRate: Number(s.lockedRate ?? 0),
    durationSeconds: Number(s.durationSeconds ?? 0),
  };
}
