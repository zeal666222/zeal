// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/consultants/[id] — public consultant profile
// ═══════════════════════════════════════════════════════════════════════════════
// Used by: booking wizard, ProfileActions, startChatFlow status pre-check.
// Returns 400 for malformed UUIDs; 404 for missing consultants; 500 for
// infrastructure failures — never conflates the three.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { createAdminClient } from "@zeal/database/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ─── Types ────────────────────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface UserRelation {
  id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  is_online: boolean | null;
}

interface ConsultantRow {
  id: string;
  category: string | null;
  perMinuteRate: number | null;
  rating: number | null;
  totalConsultations: number | null;
  sparkScore: number | null;
  specialties: string[] | null;
  languages: string[] | null;
  bio: string | null;
  user: UserRelation | UserRelation[] | null;
}

export interface ConsultantPublicResponse {
  consultant: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    category: string;
    perMinuteRate: number;
    rating: number;
    totalConsultations: number;
    sparks: number;
    isOnline: boolean;
    specialties: string[];
    languages: string[];
    bio: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickUser(rel: ConsultantRow["user"]): UserRelation | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Invalid consultant id", code: "INVALID_ID" },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("Consultant")
      .select(
        `id, category, "perMinuteRate", rating, "totalConsultations", "sparkScore",
         specialties, languages, bio,
         user:User!userId(id, name, username, avatar, is_online)`,
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[consultants/[id]] db error:", error.message);
      return NextResponse.json(
        { error: "Could not load consultant", code: "DB_ERROR" },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json(
        { error: "Consultant not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const row = data as unknown as ConsultantRow;
    const u = pickUser(row.user);
    const displayName = u?.name ?? u?.username ?? "Guide";

    const body: ConsultantPublicResponse = {
      consultant: {
        id: row.id,
        name: displayName,
        username: u?.username ?? "",
        avatar: u?.avatar ?? null,
        category: row.category ?? "HEALER",
        perMinuteRate: Number(row.perMinuteRate ?? 50),
        rating: Number(row.rating ?? 0),
        totalConsultations: Number(row.totalConsultations ?? 0),
        sparks: Number(row.sparkScore ?? 0),
        isOnline: Boolean(u?.is_online),
        specialties: row.specialties ?? [],
        languages: row.languages ?? [],
        bio: row.bio ?? "",
      },
    };

    return NextResponse.json(body, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    console.error("[consultants/[id]] fatal:", message);
    return NextResponse.json(
      { error: message, code: "INTERNAL" },
      { status: 500 },
    );
  }
}
