import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyInvite, acceptInvite } from "@/lib/auth/invites";
import { prisma } from "@zeal/database/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(12),
});

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin env missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(req: Request) {
  try {
    const { token, password } = BodySchema.parse(await req.json());

    const invite = await verifyInvite(token);
    if (!invite) return NextResponse.json({ error: "Invalid invite" }, { status: 404 });

    const sb = adminClient();
    const { data, error } = await sb.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      app_metadata: { role: invite.role },
    });

    if (error || !data?.user) {
      return NextResponse.json({ error: error?.message || "createUser failed" }, { status: 400 });
    }

    await prisma.user.upsert({
      where: { id: data.user.id },
      update: { email: invite.email, role: invite.role as never },
      create: {
        id: data.user.id,
        email: invite.email,
        username: invite.email.split("@")[0] || "user",
        role: invite.role as never,
        isVerified: true,
      },
    });

    await acceptInvite(invite.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
