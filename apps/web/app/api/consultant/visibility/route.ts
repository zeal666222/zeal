// ZEAL_FIX_VISIBILITY_V3
// ═══════════════════════════════════════════════════════════════════════════════
// Consultant visibility report — bearer + cookie aware.
//
// Uses the service-role admin client (from the guard) and does the checks
// inline, filtering by guard.userId. The consultant_visibility_report() RPC
// relies on auth.uid(), which is NULL under a service-role session, so we
// can't use it from an admin-proxy call. Inline is correct here.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { requireUserAPI } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = await requireUserAPI();
  if (!guard.ok) return guard.response;

  const { userId, admin } = guard;

  const [userRes, consultantRes] = await Promise.all([
    admin
      .from("User")
      .select("id, email, role, is_online, lastSeenAt")
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("Consultant")
      .select(`id, status, isActive, isVerified, subdomainActive, subdomain,
               category, bio, perMinuteRate, specialties, languages,
               rating, sparkScore`)
      .eq("userId", userId)
      .maybeSingle(),
  ]);

  const user = userRes.data as
    | { id: string; email: string; role: string; is_online: boolean; lastSeenAt: string | null }
    | null;

  if (!user) {
    return NextResponse.json(
      { success: false, error: "no_user_row" },
      { status: 404 },
    );
  }

  const c = consultantRes.data as
    | {
        id: string;
        status: string;
        isActive: boolean;
        isVerified: boolean;
        subdomainActive: boolean;
        subdomain: string | null;
        category: string;
        bio: string | null;
        perMinuteRate: number;
        specialties: string[] | null;
        languages: string[] | null;
        rating: number;
        sparkScore: number;
      }
    | null;

  if (!c) {
    return NextResponse.json({
      success: false,
      error: "no_consultant_row",
      user: { role: user.role, is_online: user.is_online },
    });
  }

  // MV membership — non-fatal if the MV doesn't exist yet
  let inMv = false;
  try {
    const { data: mvRow } = await admin
      .from("mv_consultant_directory")
      .select("id")
      .eq("id", c.id)
      .maybeSingle();
    inMv = Boolean(mvRow);
  } catch { /* MV missing — treat as not present */ }

  // Service count
  let serviceCount = 0;
  try {
    const { count } = await admin
      .from("ConsultantService")
      .select("*", { count: "exact", head: true })
      .eq("consultant_id", c.id);
    serviceCount = count ?? 0;
  } catch { /* table missing */ }

  const bioLength = (c.bio ?? "").length;
  const specCount = (c.specialties ?? []).length;
  const langCount = (c.languages ?? []).length;

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      is_online: user.is_online,
      lastSeenAt: user.lastSeenAt,
    },
    consultant: {
      id: c.id,
      status: c.status,
      isActive: c.isActive,
      isVerified: c.isVerified,
      subdomainActive: c.subdomainActive,
      subdomain: c.subdomain,
      category: c.category,
      bio_length: bioLength,
      perMinuteRate: c.perMinuteRate,
      specialties_count: specCount,
      languages_count: langCount,
      rating: c.rating,
      sparkScore: c.sparkScore,
    },
    checks: {
      role_is_client_admin: user.role === "CLIENT_ADMIN",
      consultant_verified: c.status === "VERIFIED",
      consultant_active: c.isActive,
      consultant_verified_flag: c.isVerified,
      in_directory_mv: inMv,
      has_services: serviceCount > 0,
      has_bio: bioLength >= 20,
      has_specialties: specCount > 0,
      has_subdomain: c.subdomain !== null,
    },
    service_count: serviceCount,
    public_url: c.subdomain ? `https://${c.subdomain}.zeal.app` : null,
    profile_url: `/consultant/${c.id}`,
  });
}
