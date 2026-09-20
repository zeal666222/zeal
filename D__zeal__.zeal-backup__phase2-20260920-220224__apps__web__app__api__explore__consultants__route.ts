// ZEAL_FIX_PHASE1_EXPLORE
// Uses v_consultant_directory view when available; falls back to the
// legacy Consultant table when the view hasn't been created yet.
import { NextResponse } from "next/server";
import { createAdminClient } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ViewRow {
  id: string;
  userId: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_online: boolean | null;
  category: string | null;
  perMinuteRate: number | null;
  rating: number | null;
  sparkScore: number | null;
  isVerified: boolean | null;
  isActive: boolean | null;
  status: string | null;
  subdomain: string | null;
  subdomainActive: boolean | null;
  specialties: string[] | null;
  languages: string[] | null;
  bio: string | null;
  totalConsultations: number | null;
}

export async function GET(req: Request) {
  try {
    const admin = createAdminClient();
    const url = new URL(req.url);

    const category = url.searchParams.get("category");
    const serviceSlug = url.searchParams.get("service");
    const onlineOnly = url.searchParams.get("online") === "true";
    const search = (url.searchParams.get("q") ?? "").trim();
    const minRating = parseFloat(url.searchParams.get("minRating") ?? "0");
    const maxRate = parseInt(url.searchParams.get("maxRate") ?? "0", 10);
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") ?? "40", 10),
      100,
    );
    const offset = Math.max(
      parseInt(url.searchParams.get("offset") ?? "0", 10),
      0,
    );

    // ─── Primary path: directory view (available after Phase 1 SQL) ─────────
    let primary: { data: ViewRow[] | null; error: unknown; count: number | null } = {
      data: null,
      error: "view_missing",
      count: 0,
    };

    try {
      let q = admin
        .from("v_consultant_directory")
        .select("*", { count: "exact" });

      if (category) q = q.eq("category", category);
      if (onlineOnly) q = q.eq("is_online", true);
      if (minRating > 0) q = q.gte("rating", minRating);
      if (maxRate > 0) q = q.lte("perMinuteRate", maxRate);
      if (search) {
        const safe = search.replace(/[%_,()]/g, "");
        q = q.or(`name.ilike.%${safe}%,username.ilike.%${safe}%`);
      }

      const res = await q
        .order("is_online", { ascending: false })
        .order("sparkScore", { ascending: false })
        .order("rating", { ascending: false })
        .range(offset, offset + limit - 1);

      primary = {
        data: (res.data ?? []) as ViewRow[],
        error: res.error,
        count: res.count ?? null,
      };
    } catch {
      /* fall through to legacy */
    }

    // ─── Fallback path: legacy Consultant + User join ───────────────────────
    let consultants: ViewRow[] = [];
    let total = 0;
    let source: "view" | "fallback" = "view";

    if (primary.error || primary.data === null) {
      source = "fallback";

      let q = admin
        .from("Consultant")
        .select(
          `
          id, category, specialties, languages, bio, "perMinuteRate",
          rating, "totalConsultations", "sparkScore", "isActive", "isVerified",
          subdomain,
          user:User!Consultant_userId_fkey(
            id, name, username, avatar_url, is_online
          )
        `,
          { count: "exact" },
        )
        .eq("status", "VERIFIED")
        .eq("isActive", true);

      if (category) q = q.eq("category", category);
      if (minRating > 0) q = q.gte("rating", minRating);
      if (maxRate > 0) q = q.lte("perMinuteRate", maxRate);

      const { data, error, count } = await q
        .order("sparkScore", { ascending: false })
        .order("rating", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      type RawRow = {
        id: string;
        category: string | null;
        specialties: string[] | null;
        languages: string[] | null;
        bio: string | null;
        perMinuteRate: number | null;
        rating: number | null;
        totalConsultations: number | null;
        sparkScore: number | null;
        isActive: boolean | null;
        isVerified: boolean | null;
        subdomain: string | null;
        user:
          | {
              id: string;
              name: string | null;
              username: string | null;
              avatar_url: string | null;
              is_online: boolean | null;
            }
          | null
          | Array<{
              id: string;
              name: string | null;
              username: string | null;
              avatar_url: string | null;
              is_online: boolean | null;
            }>;
      };

      const rows = (data ?? []) as RawRow[];
      consultants = rows.map((r) => {
        const u = Array.isArray(r.user) ? r.user[0] : r.user;
        return {
          id: r.id,
          userId: u?.id ?? "",
          name: u?.name ?? null,
          username: u?.username ?? null,
          avatar_url: u?.avatar_url ?? null,
          is_online: u?.is_online ?? false,
          category: r.category,
          perMinuteRate: r.perMinuteRate,
          rating: r.rating,
          sparkScore: r.sparkScore,
          isVerified: r.isVerified,
          isActive: r.isActive,
          status: "VERIFIED",
          subdomain: r.subdomain,
          subdomainActive: true,
          specialties: r.specialties,
          languages: r.languages,
          bio: r.bio,
          totalConsultations: r.totalConsultations,
        };
      });

      // Filter by online if requested (fallback path only)
      if (onlineOnly) consultants = consultants.filter((c) => c.is_online);

      total = count ?? consultants.length;
    } else {
      consultants = primary.data;
      total = primary.count ?? consultants.length;

      // Optional service filter (requires the join table from Phase 2)
      if (serviceSlug && consultants.length > 0) {
        try {
          const ids = consultants.map((c) => c.id);
          const { data: svc } = await admin
            .from("ConsultantService")
            .select("consultant_id, Service!inner(slug)")
            .in("consultant_id", ids)
            .eq("Service.slug", serviceSlug);
          const allowed = new Set(
            ((svc ?? []) as Array<{ consultant_id: string }>).map((r) => r.consultant_id),
          );
          consultants = consultants.filter((c) => allowed.has(c.id));
        } catch {
          /* join table not yet available — ignore */
        }
      }
    }

    return NextResponse.json({
      success: true,
      consultants,
      total,
      limit,
      offset,
      source,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}
