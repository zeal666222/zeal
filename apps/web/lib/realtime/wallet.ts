// Wallet realtime publisher — app-level broadcast after any balance change.
// The live DB trigger status is unverifiable via PostgREST, so every server
// code path that moves wallet funds calls publishWalletBalance() explicitly.
// Client subscribers read payload.record.balance; dedup in @zeal/realtime
// makes duplicate publishes harmless.
import { createAdminClient } from "@zeal/database/server";
import { serverPublish } from "./server";

export async function publishWalletBalance(
  userId: string,
  balance?: number,
): Promise<void> {
  try {
    let next = balance;
    if (next === undefined || !Number.isFinite(next)) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("Wallet")
        .select("balance")
        .eq("userId", userId)
        .maybeSingle();
      const row = data as { balance?: number } | null;
      if (!row || typeof row.balance !== "number") return;
      next = Number(row.balance);
    }
    await serverPublish(`user:${userId}:wallet`, "UPDATE", {
      type: "UPDATE",
      record: { userId, balance: next },
    });
  } catch (err) {
    console.warn("[realtime] wallet balance publish failed:", err);
  }
}
