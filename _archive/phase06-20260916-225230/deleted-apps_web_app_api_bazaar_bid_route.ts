import { NextResponse } from "next/server";
import { createClient } from "@zeal/database";
import * as Ledger from "@/lib/wallet/ledger";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { listingId, bidAmount } = await req.json();

    // 1. Verify Wallet Balance
    const balance = await Ledger.getWalletBalance(session.user.id);
    if (balance < bidAmount) {
      return NextResponse.json({ error: "Insufficient wallet balance." }, { status: 400 });
    }

    // 2. Deduct funds and place in escrow
    await Ledger.holdInEscrow(
      session.user.id, 
      bidAmount, 
      `bazaar_${listingId}`, 
      `Bid placed on listing ${listingId}`
    );

    return NextResponse.json({ success: true, message: "Bid placed successfully!" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
