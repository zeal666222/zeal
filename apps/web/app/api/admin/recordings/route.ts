import { NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/auth/api-guard";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async () => {
  const guard = await requireAdminAPI("SUPPORT");
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { data, error } = await admin
    .from("CallSession")
    .select(`
      id, startTime, endTime, durationSeconds, recordingUrl, recordingReady, createdAt,
      booking:Booking!bookingId(
        consultant:Consultant!consultantId(
          user:User!userId(name, username)
        )
      )
    `)
    .not("recordingUrl", "is", null)
    .order("createdAt", { ascending: false })
    .limit(200);

  if (error) throw new AppError(error.message, 500, ErrorCode.INTERNAL_DATABASE, { context: "admin.recordings" });

  return NextResponse.json({ items: data ?? [], total: (data ?? []).length });
});
