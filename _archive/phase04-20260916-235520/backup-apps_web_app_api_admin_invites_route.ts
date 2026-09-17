import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createInvite } from "@/lib/auth/invites";
import { audit, requestMeta } from "@/lib/audit";
import { isAdminRole, roleAtLeast, type AdminRole } from "@/lib/auth/roles";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { z } from "zod";

export const dynamic = "force-dynamic";

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "SUPPORT", "VIEWER"]),
});

async function getCaller() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const sb = createServerClient(url, key, {
    cookies: {
      get: (n) => cookieStore.get(n)?.value,
      set: () => {},
      remove: () => {},
    },
  });
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export const POST = withErrorHandler(async (req: Request) => {
  const user = await getCaller();
  if (!user) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);

  const callerRole = user.app_metadata?.role;
  if (!isAdminRole(callerRole) || !roleAtLeast(callerRole, "SUPER_ADMIN")) {
    throw new AppError("Forbidden — SUPER_ADMIN only", 403, ErrorCode.AUTH_FORBIDDEN);
  }

  const body = await req.json();
  const { email, role } = InviteSchema.parse(body);

  if (!roleAtLeast(callerRole, role as AdminRole)) {
    throw new AppError("Cannot invite a role higher than your own", 403, ErrorCode.AUTH_FORBIDDEN);
  }

  const { token, expiresAt } = await createInvite({
    email: email.toLowerCase(),
    role: role as AdminRole,
    invitedBy: user.id,
  });

  const meta = requestMeta(req);
  await audit({
    userId: user.id,
    email: user.email ?? null,
    action: "invite.create",
    targetType: "admin_invite",
    targetId: email,
    metadata: { role },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  const adminBaseUrl = process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3001";
  const inviteUrl = adminBaseUrl + "/accept-invite?token=" + encodeURIComponent(token);

  return NextResponse.json({ success: true, inviteUrl, expiresAt });
});

