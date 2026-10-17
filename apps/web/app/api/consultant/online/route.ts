import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { safeQuery, safeQueryOne, safePublish } from "@/lib/infra/guards";
import { evaluateConsultantProfile } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = withErrorHandler(async (req: Request) => {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  let body: { is_online?: boolean };
  try {
    body = await req.json();
  } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }
  if (typeof body.is_online !== "boolean") {
    throw new AppError("is_online must be boolean", 400, ErrorCode.VALIDATION_INPUT);
  }

  let completenessWarning: Record<string, unknown> = {};

  if (body.is_online === true) {
    const c = await safeQueryOne<{ status: string }>(
      admin.from("Consultant")
        .select('bio, "perMinuteRate", specialties, languages, availability, category, status')
        .eq("userId", userId)
        .maybeSingle(),
      "online.consultant",
    );

    if (!c) {
      throw new AppError("Sign up as a consultant first.", 403, ErrorCode.AUTH_FORBIDDEN);
    }
    if (c.status === "SUSPENDED") {
      throw new AppError("Account suspended.", 403, ErrorCode.AUTH_FORBIDDEN);
    }

    const report = evaluateConsultantProfile(c);
    if (!report.isLive) {
      completenessWarning = {
        warning: "PROFILE_INCOMPLETE",
        message: "You're online, but you won't appear in the directory until your profile is complete.",
        score: report.score, checks: report.checks,
      };
    }
  }

  await safeQuery(
    admin.from("User").update({ is_online: body.is_online }).eq("id", userId),
    "online.update",
  );

  safePublish(`consultant:${userId}:status`, "status_updated", {
    consultantId: userId, is_online: body.is_online,
  });
  safePublish("consultants:live", "status_changed", {
    consultantId: userId, is_online: body.is_online, at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, is_online: body.is_online, ...completenessWarning });
});
