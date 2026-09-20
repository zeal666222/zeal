import {NextResponse} from "next/server";
import {requireAdminAPI, logAdminAction} from "@/lib/auth/api-guard";
import {sendEmail} from "@/lib/emails";

export const dynamic = "force-dynamic";

export async function POST(req: Request, {params}: {params: Promise<{id: string}>}) {
  const guard = await requireAdminAPI("SUPPORT");
  if (!guard.ok) return guard.response;
  const {admin, userId: adminId} = guard;
  const {id} = await params;

  const {data: session} = await admin
    .from("CallSession")
    .select(`id, recordingUrl,
      booking:Booking!CallSession_bookingId_fkey(
        userId,
        user:User!Booking_userId_fkey(email),
        consultant:Consultant!Booking_consultantId_fkey(userId, user:User!Consultant_userId_fkey(email))
      )`)
    .eq("id", id)
    .maybeSingle();

  if (!session) return NextResponse.json({error: "Session not found"}, {status: 404});
  if (!session.recordingUrl) return NextResponse.json({error: "No recording available"}, {status: 400});

  const booking = (session as unknown as {booking?: {user?: {email?: string}; consultant?: {user?: {email?: string}}}}).booking;
  const recipients = [booking?.user?.email, booking?.consultant?.user?.email]
    .filter((e): e is string => typeof e === "string" && e.length > 0);

  let sent = 0;
  for (const to of recipients) {
    try {
      await sendEmail({
        to,
        subject: "Your Zeal session recording",
        html: `<p>Your session recording is available:</p><p><a href="${session.recordingUrl}">${session.recordingUrl}</a></p>`,
      });
      sent++;
    } catch (err) {
      console.warn("[Recordings] Email to " + to + " failed:", err);
    }
  }

  await logAdminAction(admin, {
    adminId,
    action: "recording.send",
    targetType: "recording",
    targetId: id,
    metadata: {sent, recipients},
  });

  return NextResponse.json({success: true, sent});
}
