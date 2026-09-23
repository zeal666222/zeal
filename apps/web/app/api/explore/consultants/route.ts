// ZEAL_FIX_PHASE2_EXPLORE
// Reads from the materialized view via search_consultants RPC.
// Falls back to the legacy path if the RPC isn't deployed yet.
import { NextResponse } from "next/server";
import { createAdminClient } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SearchRow {
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
  service_slugs: string[] | null;
  category_ids: string[] | null;
}

interface RawLegacyRow {
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
    | Array<{
        id: string;
        name: string | null;
        username: string | null;
        avatar_url: string | null;
        is_online: boolean | null;
      }>
    | null;
}

export async function GET(req: Request) {
  try {
    const admin = createAdminClient();
    const url = new URL(req.url);

    const filters: Record<string, unknown> = {};
    const category = url.searchParams.get("category");
    const service = url.searchParams.get("service");
    const search = url.searchParams.get("q");
    const sort = url.searchParams.get("sort");
    const minRating = url.searchParams.get("minRating");
    const maxRate = url.searchParams.get("maxRate");

    if (category) filters.category = category;
    if (service) filters.service = service;
    if (search) filters.q = search;
    if (sort) filters.sort = sort;
    if (minRating) filters.minRating = Number(minRating);
    if (maxRate) filters.maxRate = Number(maxRate);
    if (url.searchParams.get("online") === "true") filters.online = true;

    filters.limit = Math.min(Number(url.searchParams.get("limit") ?? 40), 100);
    filters.offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

    const { data, error } = await admin.rpc("search_consultants", {
      p_filters: filters,
    });

    if (error) {
      const legacy = await admin
        .from("Consultant")
        .select(
          `id, category, specialties, languages, bio, "perMinuteRate",
           rating, "totalConsultations", "sparkScore", "isActive", "isVerified",
           subdomain, user:User!userId(id, name, username, avatar_url, is_online)`,
          { count: "exact" },
        )
        .eq("status", "VERIFIED")
        .eq("isActive", true)
        .order("sparkScore", { ascending: false })
        .range(
          Number(filters.offset),
          Number(filters.offset) + Number(filters.limit) - 1,
        );

      if (legacy.error) {
        console.error("[explore/consultants] legacy fallback failed:", legacy.error.message);
        return NextResponse.json(
          { success: true, consultants: [], total: 0, source: "fallback-empty" },
          { headers: { "Cache-Control": "no-store, max-age=0" } },
        );
      }

      const rows = (legacy.data ?? []) as unknown as RawLegacyRow[];
      const consultants = rows.map((r) => {
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
          service_slugs: [],
          category_ids: [],
        } satisfies SearchRow;
      });

      return NextResponse.json({
        success: true,
        consultants,
        total: legacy.count ?? consultants.length,
        source: "fallback",
      });
    }

    const payload = (data ?? {}) as {
      consultants?: SearchRow[];
      total?: number;
    };

    return NextResponse.json({
      success: true,
      consultants: payload.consultants ?? [],
      total: payload.total ?? 0,
      source: "mv",
    });
  } catch (err) {
    return NextResponse.json(
        { success: true, consultants: [], total: 0, source: "outer-error" },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      );
  }
}
