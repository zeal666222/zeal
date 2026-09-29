import { NextResponse } from "next/server";
import crypto from "crypto";
import * as Ledger from "@/lib/wallet/ledger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // Instamojo MAC is computed over the raw URL-encoded body — must read text first
    const rawBody = await req.text();
    const params = new URLSearchParams(rawBody);
    const macProvided = params.get("mac") ?? "";
    const paymentId = params.get("payment_id") ?? "";
    const status = params.get("status") ?? "";
    const amount = parseFloat(params.get("amount") ?? "0");
    const userId = params.get("buyer_name") ?? "";

    if (!macProvided || !paymentId || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Rebuild MAC payload per Instamojo spec
    params.delete("mac");
    const sortedKeys = Array.from(params.keys()).sort();
    const macData = sortedKeys.map((k) => params.get(k) ?? "").join("|");

    const salt = process.env.INSTAMOJO_SALT;
    if (!salt) {
      console.error("[instamojo] INSTAMOJO_SALT missing");
      return NextResponse.json({ error: "Config error" }, { status: 500 });
    }

    const expectedMac = crypto
      .createHmac("sha1", salt)
      .update(macData)
      .digest("hex");

    if (expectedMac !== macProvided) {
      console.warn("[instamojo] MAC mismatch — rejecting");
      return NextResponse.json({ error: "Invalid MAC signature" }, { status: 401 });
    }

    if (status === "Credit" && amount > 0) {
      const already = await Ledger.getByReferenceId(paymentId);
      if (already) {
        return NextResponse.json({ success: true, message: "Already processed" });
      }

      await Ledger.creditFunds({
        userId,
        amount,
        description: "Instamojo Wallet Top-up",
        referenceId: paymentId,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[instamojo] webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
