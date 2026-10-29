import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";
import { withErrorHandler } from "@/lib/errors";
import { safeQuery, safeQueryOne } from "@/lib/infra/guards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withErrorHandler(async () => {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;
  const { userId, admin } = guard;

  const [user, consultant] = await Promise.all([
    safeQueryOne<{ id: string; email: string; role: string; is_online: boolean; lastSeenAt: string | null }>(
      admin.from("User").select("id, email, role, is_online, lastSeenAt").eq("id", userId).maybeSingle(),
      "visibility.user",
    ),
    safeQueryOne<{
      id: string; status: string; isActive: boolean; isVerified: boolean;
      subdomainActive: boolean; subdomain: string | null; category: string;
      bio: string | null; perMinuteRate: number; specialties: string[] | null;
      languages: string[] | null; rating: number; sparkScore: number;
    }>(
      admin.from("Consultant")
        .select(`id, status, isActive, isVerified, subdomainActive, subdomain,
                 category, bio, perMinuteRate, specialties, languages, rating, sparkScore`)
        .eq("userId", userId)
        .maybeSingle(),
      "visibility.consultant",
    ),
  ]);

  if (!user) {
    return NextResponse.json({ success: false, error: "no_user_row" }, { status: 404 });
  }

  if (!consultant) {
    return NextResponse.json({
      success: false, error: "no_consultant_row",
      user: { role: user.role, is_online: user.is_online },
    });
  }

  let inMv = false;
  try {
    const mvRow = await safeQueryOne<{ id: string }>(
      admin.from("mv_consultant_directory").select("id").eq("id", consultant.id).maybeSingle(),
      "visibility.mv",
    );
    inMv = Boolean(mvRow);
  } catch { /* MV missing — non-fatal */ }

  let serviceCount = 0;
  try {
    const { count } = await admin
      .from("ConsultantService")
      .select("*", { count: "exact", head: true })
      .eq("consultant_id", consultant.id);
    serviceCount = count ?? 0;
  } catch { /* table missing — non-fatal */ }

  const bioLength = (consultant.bio ?? "").length;
  const specCount = (consultant.specialties ?? []).length;
  const langCount = (consultant.languages ?? []).length;

  return NextResponse.json({
    success: true,
    user: { id: user.id, email: user.email, role: user.role, is_online: user.is_online, lastSeenAt: user.lastSeenAt },
    consultant: {
      id: consultant.id, status: consultant.status, isActive: consultant.isActive,
      isVerified: consultant.isVerified, subdomainActive: consultant.subdomainActive,
      subdomain: consultant.subdomain, category: consultant.category,
      bio_length: bioLength, perMinuteRate: consultant.perMinuteRate,
      specialties_count: specCount, languages_count: langCount,
      rating: consultant.rating, sparkScore: consultant.sparkScore,
    },
    checks: {
      role_is_client_admin: user.role === "CLIENT_ADMIN",
      consultant_verified: consultant.status === "VERIFIED",
      consultant_active: consultant.isActive,
      consultant_verified_flag: consultant.isVerified,
      in_directory_mv: inMv, has_services: serviceCount > 0,
      has_bio: bioLength >= 20, has_specialties: specCount > 0,
      has_subdomain: consultant.subdomain !== null,
    },
    service_count: serviceCount,
    public_url: consultant.subdomain ? `https://${consultant.subdomain}.zealer.co.in` : null,
    profile_url: `/consultant/${consultant.id}`,
  });
});
