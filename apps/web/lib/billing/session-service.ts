// ═══════════════════════════════════════════════════════════════════════════════
// Billing session service — server-authoritative per-minute billing
// ═══════════════════════════════════════════════════════════════════════════════
// All time-based calculations use the SERVER's clock. The client only sends
// heartbeats — never amounts or durations.
//
// Idempotency: process_per_minute_deduction keys on (session_id:minute_key).
// Retries within the same minute are no-ops.
// ═══════════════════════════════════════════════════════════════════════════════

import { createAdminClient } from "@zeal/database/server";
import {
  MIN_START_MINUTES,
  LOW_BALANCE_THRESHOLD_MINUTES,
  type BillingSession,
  type SessionStartResult,
  type HeartbeatResult,
  type SessionEndResult,
} from "./types";

// ─── Lookup rate ─────────────────────────────────────────────────────────────
async function lookupRate(
  admin: ReturnType<typeof createAdminClient>,
  consultantId: string | null,
  aiConsultantId: string | null,
): Promise<{ rate: number; isAI: boolean } | null> {
  if (aiConsultantId) {
    const { data } = await admin
      .from("AIConsultant")
      .select('"perMinuteRate"')
      .eq("id", aiConsultantId)
      .eq("isActive", true)
      .maybeSingle();
    if (!data) return null;
    return { rate: Number((data as { perMinuteRate: number }).perMinuteRate ?? 0), isAI: true };
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

// ─── Lookup wallet ───────────────────────────────────────────────────────────
async function lookupWallet(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{ id: string; balance: number; escrow: number } | null> {
  const { data } = await admin
    .from("Wallet")
    .select("id, balance, escrow")
    .eq("userId", userId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { id: string; balance: number; escrow: number };
  return { id: row.id, balance: Number(row.balance), escrow: Number(row.escrow) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// START SESSION
// ═══════════════════════════════════════════════════════════════════════════════
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

  // Free AI — no billing needed
  if (isAI && rate === 0) {
    const { data: session } = await admin
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
    return {
      success: true,
      sessionId: (session as { id: string }).id,
      rate: 0,
      initialMinutes: 0,
      initialCharge: 0,
    };
  }

  const wallet = await lookupWallet(admin, userId);
  if (!wallet) {
    return { success: false, error: "Wallet not found.", code: "INTERNAL" };
  }

  const initialMinutes = MIN_START_MINUTES;
  const initialCharge = rate * initialMinutes;

  if (wallet.balance < initialCharge) {
    return {
      success: false,
      error: `Insufficient balance. Need ₹${initialCharge.toFixed(2)} for ${initialMinutes} minutes.`,
      code: "LOW_BALANCE",
    };
  }

  // Hold escrow atomically
  const referenceId = `session-start:${userId}:${Date.now()}`;
  const { error: escrowErr } = await admin.rpc("hold_in_escrow_safe", {
    p_user_id: userId,
    p_amount: initialCharge,
    p_reference_id: referenceId,
    p_description: `Session hold — ${initialMinutes} min @ ₹${rate}/min`,
  });

  if (escrowErr) {
    return { success: false, error: "Could not hold funds.", code: "INTERNAL" };
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
    // Rollback escrow
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

// ═══════════════════════════════════════════════════════════════════════════════
// HEARTBEAT
// ═══════════════════════════════════════════════════════════════════════════════
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
    return {
      success: true,
      sessionId,
      elapsedSeconds,
      minutesBilled: 0,
      cost: 0,
      remaining: 0,
      terminate: false,
    };
  }

  let lastBilled = Math.floor((session.durationSeconds ?? 0) / 60);
  const minutesToBill = minutesElapsed - lastBilled;

  for (let i = 0; i < minutesToBill; i++) {
    const minuteKey = new Date(startMs + (lastBilled + i + 1) * 60_000)
      .toISOString()
      .slice(0, 16)
      .replace(/[-T:]/g, "");

    // ─── CRITICAL: pass p_is_ai (fixes AI money leak) ───────────────────────
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

    const result = rpcData as { success?: boolean; terminate?: boolean } | null;
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
  }

  await admin
    .from("CallSession")
    .update({ durationSeconds: minutesElapsed * 60 })
    .eq("id", sessionId);

  const wallet = await lookupWallet(admin, userId);
  const remaining = wallet ? wallet.balance + wallet.escrow : 0;
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
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// END SESSION
// ═══════════════════════════════════════════════════════════════════════════════
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

  // Authorization: owner OR consultant
  if (session.userId !== userId && session.consultantId !== userId) {
    const { data: myConsultant } = await admin
      .from("Consultant")
      .select("id")
      .eq("userId", userId)
      .maybeSingle();
    if (!myConsultant || session.consultantId !== (myConsultant as { id: string }).id) {
      return { success: false, error: "Not authorized to end this session." };
    }
  }

  if (session.status === "ENDED") {
    return {
      success: true,
      sessionId,
      durationSeconds: session.durationSeconds,
      totalCost: session.amount,
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

  // Refund unused escrow
  const heldAmount = Number(session.amount ?? 0);
  const refunded = Math.max(0, heldAmount - totalCost);

  if (refunded > 0 && !isAI) {
    await admin.rpc("credit_funds_safe", {
      p_user_id: session.userId,
      p_amount: refunded,
      p_description: `Session refund — unused balance`,
      p_reference_id: `session-refund:${sessionId}`,
    });
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

  // Credit consultant for human sessions
  if (!isAI && consultantEarning > 0 && session.consultantId) {
    const { data: consultantRow } = await admin
      .from("Consultant")
      .select("userId")
      .eq("id", session.consultantId)
      .maybeSingle();
    const consultantUserId = (consultantRow as { userId?: string } | null)?.userId;

    if (consultantUserId) {
      await admin.rpc("credit_funds_safe", {
        p_user_id: consultantUserId,
        p_amount: consultantEarning,
        p_description: `Session earning — ${durationMinutes} min`,
        p_reference_id: `session-earn:${sessionId}`,
      });
    }
  }

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
