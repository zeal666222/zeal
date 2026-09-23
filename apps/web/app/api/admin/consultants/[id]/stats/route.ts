import {NextResponse} from "next/server";
import {requireAdminAPI} from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, {params}: {params: Promise<{id: string}>}) {
  const guard = await requireAdminAPI("ADMIN");
  if (!guard.ok) return guard.response;
  const {admin} = guard;
  const {id} = await params;

  const {data: consultant} = await admin
    .from("Consultant")
    .select(`*, user:User!userId(id, name, email, avatar)`)
    .eq("id", id)
    .maybeSingle();

  if (!consultant) return NextResponse.json({error: "Not found"}, {status: 404});

  const [bookingsRes, callsRes] = await Promise.all([
    admin.from("Booking").select("*", {count: "exact", head: true}).eq("consultantId", id),
    admin.from("CallSession").select("*", {count: "exact", head: true}).eq("consultantId", id),
  ]);

  return NextResponse.json({
    consultant,
    stats: {
      totalBookings: bookingsRes.count ?? 0,
      totalCalls: callsRes.count ?? 0,
      rating: consultant.rating,
      totalConsultations: consultant.totalConsultations,
    },
  });
}
