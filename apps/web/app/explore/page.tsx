// ZEAL_PHASE1_V1
// ═══════════════════════════════════════════════════════════════════════════════
// /explore — luxury discovery
// ─────────────────────────────────────────────────────────────────────────────
// Server component fetches initial directory via search_consultants RPC.
// Client island (ConsultantDirectory) handles search, filters, realtime.
// ═══════════════════════════════════════════════════════════════════════════════

import { createServerClientFromCookies } from "@zeal/database/server";
import { Compass, ShieldCheck } from "lucide-react";
import { ConsultantDirectory } from "./ConsultantDirectory";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface MvRow {
  id: string;
  userId: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_online: boolean;
  lastSeenAt: string | null;
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

async function loadDirectory(): Promise<MvRow[]> {
  try {
    const supabase = await createServerClientFromCookies();
    const { data, error } = await supabase.rpc("search_consultants", {
      p_filters: { limit: 60, sort: "relevance" },
    });
    if (error) {
      console.error("[explore] rpc failed:", error.message);
      return [];
    }
    const payload = (data ?? {}) as { consultants?: MvRow[] };
    return payload.consultants ?? [];
  } catch (err) {
    console.error("[explore] fatal:", err);
    return [];
  }
}

export default async function ExplorePage() {
  const consultants = await loadDirectory();
  const onlineCount = consultants.filter((c) => c.is_online).length;

  return (
    <div className="min-h-screen-app bg-slate-950 text-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-[var(--color-luxury-glass-border)] noise-overlay">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0B0A14] via-[#1A1430] to-[#0B0A14]" />
          <div className="absolute top-0 right-0 w-80 h-80 bg-[var(--color-luxury-gold)]/8 blur-[120px] rounded-full pointer-events-none" />
          <div className="relative z-10 p-8 md:p-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full
                            bg-[var(--color-luxury-gold)]/10 border border-[var(--color-luxury-gold)]/20
                            text-[var(--color-luxury-gold)] text-xs font-bold mb-4">
              <Compass size={14} /> Discovery
            </div>
            <h1
              className="text-3xl sm:text-5xl font-black text-white tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Connect with verified guides
            </h1>
            <p className="text-slate-400 text-sm mt-3 max-w-xl">
              {consultants.length} consultant
              {consultants.length !== 1 ? "s" : ""} in the directory.
              {onlineCount > 0 && (
                <>
                  {" "}
                  <span className="text-emerald-400 font-bold">
                    {onlineCount} online now
                  </span>
                  .
                </>
              )}
            </p>
          </div>
        </div>

        {/* Client directory — search, filters, realtime */}
        <ConsultantDirectory initialConsultants={consultants} />

        {/* Trust footer */}
        <div className="text-center text-[11px] text-slate-600 flex items-center justify-center gap-2 pt-8">
          <ShieldCheck size={11} /> Every consultant is identity-verified
        </div>
      </div>
    </div>
  );
}
