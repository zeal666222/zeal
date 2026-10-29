import { NextResponse } from "next/server";
import { createServerClientFromCookies, createAdminClient } from "@zeal/database/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BankSchema = z.object({
  accountNumber: z.string().trim().min(9).max(30),
  ifsc: z.string().trim().min(8).max(20).regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC format"),
  accountHolder: z.string().trim().min(2).max(100),
});

export async function GET() {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: consultant, error } = await admin
    .from("Consultant")
    .select("bankAccountNumber, bankIfsc, bankAccountHolder")
    .eq("userId", user.id)
    .maybeSingle();

  if (error || !consultant) {
    return NextResponse.json({ error: "No consultant profile" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    accountNumber: consultant.bankAccountNumber,
    ifsc: consultant.bankIfsc,
    accountHolder: consultant.bankAccountHolder,
  });
}

export async function PUT(req: Request) {
  const supabase = await createServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BankSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 422 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("update_consultant_bank", {
    p_account_number: parsed.data.accountNumber,
    p_ifsc: parsed.data.ifsc,
    p_account_holder: parsed.data.accountHolder,
  });

  if (error) {
    return NextResponse.json({ error: "Failed to save bank details" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
