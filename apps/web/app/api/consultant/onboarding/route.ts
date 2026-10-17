import { NextResponse } from "next/server";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";
import { safeQuery } from "@/lib/infra/guards";
import { createClient } from "@zeal/database/server";
import { mapPgError } from "@/lib/errors";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export const POST = withErrorHandler(async (req: Request) => {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    throw new AppError("Invalid JSON", 400, ErrorCode.VALIDATION_INPUT);
  }

  const { data: consultant, error } = await supabase
    .from("Consultant")
    .upsert({
      id: crypto.randomUUID(),
      userId: session.user.id,
      category: (body.category as string) || "ASTROLOGER",
      specialties: (body.specialties as string[]) || [],
      languages: (body.languages as string[]) || ["English"],
      bio: (body.bio as string) || null,
      perMinuteRate: (body.perMinuteRate as number) || 50,
      availability: (body.availability as Record<string, unknown>) || {},
      verificationDocs: (body.verificationDocs as Record<string, unknown>) || {},
      status: "PENDING",
      bufferMinutes: 10,
      updatedAt: new Date().toISOString(),
    } as any, { onConflict: "userId" })
    .select()
    .single();

  if (error) {
    const mapped = mapPgError(error.code ?? "", error.message);
    throw new AppError(mapped.userMessage, mapped.httpStatus, ErrorCode.INTERNAL_DATABASE, { pgCode: error.code });
  }

  const { error: authError } = await supabase.auth.updateUser({
    data: { is_consultant_applicant: true },
  });
  if (authError) {
    console.warn("[onboarding] Failed to update auth metadata:", authError.message);
  }

  return NextResponse.json({ success: true, consultant });
});
