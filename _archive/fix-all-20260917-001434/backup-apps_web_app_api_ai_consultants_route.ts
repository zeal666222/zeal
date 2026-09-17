import { NextResponse } from "next/server";
import { prisma } from "@zeal/database";
import { createAdminClient } from "@zeal/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Fetch AI consultants.
 *
 * Strategy:
 *   1. Try Prisma first (fast, typed)
 *   2. If Prisma fails or returns empty, fall back to Supabase service role
 *      (which bypasses RLS and can always read the table)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  // ─── Attempt 1: Prisma ────────────────────────────────────────────────
  try {
    const where: Record<string, unknown> = { isActive: true };
    if (category) where.category = category;

    const consultants = await prisma.aIConsultant.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { rating: "desc" }, { name: "asc" }],
    });

    if (consultants.length > 0) {
      return NextResponse.json(consultants, {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    console.warn("[AI Consultants API] Prisma returned 0 rows – trying Supabase fallback");
  } catch (prismaError) {
    console.error("[AI Consultants API] Prisma failed:", prismaError);
  }

  // ─── Attempt 2: Supabase Service Role (bypasses RLS) ───────────────────
  try {
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json([], {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    let query = admin
      .from("AIConsultant")
      .select("*")
      .eq("isActive", true)
      .order("isFeatured", { ascending: false })
      .order("rating", { ascending: false });

    if (category) query = query.eq("category", category);

    const { data, error } = await query;

    if (error) {
      console.error("[AI Consultants API] Supabase fallback error:", error);
      return NextResponse.json([], {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    return NextResponse.json(data ?? [], {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (supabaseError) {
    console.error("[AI Consultants API] Supabase fallback failed:", supabaseError);
    return NextResponse.json([], {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
