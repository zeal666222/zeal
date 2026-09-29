// ═══════════════════════════════════════════════════════════════════════════════
// apps/web/lib/billing/session-service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Server-authoritative per-minute billing. Escrow is held on start, refunded
// on end via release_session_escrow. Every minute deduction is idempotent by
// (sessionId, YYYYMMDDHHMM).
// ═══════════════════════════════════════════════════════════════════════════════
import "server-only";
import { createAdminClient } from "@zeal/database/server";
import {
  MIN_START_MINUTES,
  LOW_BALANCE_THRESHOLD_MINUTES,
  type BillingSession,
  type HeartbeatResult,
  type SessionEndResult,
  type SessionStartResult,
  type WalletState,
} from "./types";

type Admin = ReturnType<typeof createAdminClient>;

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
  const { data } = await admin
    .from("Consultant")
    .select('"perMinuteRate", "isActive"')
    .eq("id", consultantId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { perMinuteRate: number; isActive: boolean };
  if (!row.isActive) return null;
  return { rate: Number(row.perMinuteRate ?? 0), isAI: false };
}

async function lookupWallet(admin: Admin, userId: string): Promise<WalletState | null> {
  const { data } = await admin
    .from("Wallet")
    .select("balance, escrow, \"pendingIn\", \"pendingOut\", blocked")
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
    const { data: session, error } = await admin
      .from("CallSession")
      .insert({
        userId,
        consultantId: null,
        aiConsultantId,
        isAI: true,
        status: "CONNECTED",
        amount: 0,
        startTime: new Date().toISOString(),
        conversationId: conversationId ?? null,
      })
      .select("id")
      .single();
    if (error || !session) return { success: false, error: error?.message ?? "Insert failed", code: "INTERNAL" };
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
    return { success: false, error: "Could not start session.", code: "INTERNAL" };
  }

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
  const admin = createAdminClient();

  const { data: sessionRaw } = await admin
    .from("CallSession")
    .select('id, "userId", "consultantId", "aiConsultantId", "isAI", "startTime", "endTime", "durationSeconds", amount, status, "conversationId"')
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

  const rateInfo = await lookupRate(admin, session.consultantId, session.aiConsultantId);
  if (!rateInfo) return { success: false, error: "Consultant unavailable." };
  const { rate, isAI } = rateInfo;

  if (isAI && rate === 0) {
    const walletState = await lookupWallet(admin, userId);
    return {
      success: true,
      sessionId,
      elapsedSeconds,
      minutesBilled: 0,
      cost: 0,
      remaining: 0,
      terminate: false,
      ...(walletState ? { walletState } : {}),
    };
  }

  const lastBilled = Math.floor((session.durationSeconds ?? 0) / 60);
  const minutesToBill = minutesElapsed - lastBilled;

  for (let i = 0; i < minutesToBill; i++) {
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
      console.error("[billing] minute deduct error:", rpcErr);
      break;
    }

    const result = rpcData as { success?: boolean; terminate?: boolean; remaining?: number } | null;
    if (result && result.success === false) {
      await admin
        .from("CallSession")
        .update({
          status: "ENDED",
          endTime: new Date().toISOString(),
          durationSeconds: minutesElapsed * 60,
        })
        .eq("id", sessionId);

      return {
        success: true,
        sessionId,
        elapsedSeconds,
        minutesBilled: lastBilled + i,
        cost: (lastBilled + i) * rate,
        remaining: 0,
        terminate: true,
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
  }

  await admin
    .from("CallSession")
    .update({ durationSeconds: minutesElapsed * 60 })
    .eq("id", sessionId);

  const walletState = await lookupWallet(admin, userId);
  const remaining = walletState ? walletState.balance + walletState.escrow : 0;
  const minutesRemaining = rate > 0 ? Math.floor(remaining / rate) : 999;
  const terminate = minutesRemaining <= LOW_BALANCE_THRESHOLD_MINUTES;

  return {
    success: true,
    sessionId,
    elapsedSeconds,
    minutesBilled: minutesElapsed,
    cost: minutesElapsed * rate,
    remaining,
    terminate,
    reason: terminate ? `Only ${minutesRemaining} minute(s) left.` : undefined,
    ...(walletState ? { walletState } : {}),
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
    .select('id, "userId", "consultantId", "aiConsultantId", "isAI", "startTime", "endTime", "durationSeconds", amount, status')
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
      success: true,
      sessionId,
      durationSeconds: session.durationSeconds,
      totalCost: session.amount,
      refunded: 0,
    };
  }

  const endMs = Date.now();
  const startMs = new Date(session.startTime).getTime();
  const durationSeconds = Math.floor((endMs - startMs) / 1000);
  const durationMinutes = Math.ceil(durationSeconds / 60);

  const rateInfo = await lookupRate(admin, session.consultantId, session.aiConsultantId);
  const rate = rateInfo?.rate ?? 0;
  const isAI = session.isAI;

  const totalCost = durationMinutes * rate;
  const platformFee = totalCost * 0.10;
  const consultantEarning = totalCost - platformFee;

  const heldAmount = Number(session.amount ?? 0);

  // ─── Single source of truth: release_session_escrow ─────────────────────
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

  return {
    success: true,
    sessionId,
    durationSeconds,
    totalCost,
    consultantEarning,
    platformFee,
    refunded,
  };
}
