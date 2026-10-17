import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async (req: Request) => {
  const guard = await requireAdminAPI("SUPER_ADMIN");
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);

  let q = admin.from("AdminAuditLog").select("*").order("createdAt", { ascending: false }).limit(limit);
  if (action) q = q.eq("action", action);

  const { data, error } = await q;
  if (error) throw new AppError(error.message, 500, ErrorCode.INTERNAL_DATABASE, { context: "admin.audit" });

  return NextResponse.json({ items: data ?? [] });
});
