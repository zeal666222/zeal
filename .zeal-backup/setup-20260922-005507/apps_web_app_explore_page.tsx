// ZEAL_FIX_EXPLORE_MV
// ═══════════════════════════════════════════════════════════════════════════════
// /explore — reads from mv_consultant_directory via search_consultants RPC
// The MV is auto-refreshed on every Consultant INSERT/UPDATE by trigger
// trg_consultant_refresh_mv (migration 110).
// ═══════════════════════════════════════════════════════════════════════════════

import { createServerClientFromCookies } from "@zeal/database/server";
import Link from "next/link";
import { Compass, Radio, ShieldCheck, Sparkles } from "lucide-react";
import { EmptyState } from "@zeal/ui";

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

async function loadDirectory(): Promise<{ consultants: MvRow[]; source: string }> {
  try {
    const supabase = await createServerClientFromCookies();
    const { data, error } = await supabase.rpc("search_consultants", {
      p_filters: { limit: 60, sort: "relevance" },
    });
    if (error) {
      console.error("[explore] rpc failed:", error.message);
      return { consultants: [], source: "error" };
    }
    const payload = (data ?? {}) as { consultants?: MvRow[]; source?: string };
    return {
      consultants: payload.consultants ?? [],
      source: payload.source ?? "mv",
    };
  } catch (err) {
    console.error("[explore] fatal:", err);
    return { consultants: [], source: "error" };
  }
}

export default async function ExplorePage() {
  const { consultants, source } = await loadDirectory();
  const onlineCount = consultants.filter((c) => c.is_online).length;
  const withServices = consultants.filter((c) => (c.service_slugs ?? []).length > 0).length;

  return (
    <div className="min-h-screen-app bg-slate-950 text-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-950 p-6 md:p-10">
          <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold mb-4">
              <Compass size={14} /> Discovery
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Connect with verified guides
            </h1>
            <p className="text-slate-400 text-sm mt-2 max-w-xl">
              {consultants.length} consultant{consultants.length !== 1 ? "s" : ""} live in the directory.
              {onlineCount > 0 && <> <span className="text-emerald-400 font-bold">{onlineCount} online now</span>.</>}
              {withServices > 0 && <> {withServices} offering specific services.</>}
            </p>
            {source === "base" && (
              <p className="text-[10px] text-amber-400 mt-3 uppercase tracking-widest font-bold">
                ⚠ Directory index rebuilding — showing fresh data
              </p>
            )}
          </div>
        </div>

        {/* Grid */}
        {consultants.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No consultants yet"
            description="Check back soon — new guides are onboarding every day."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {consultants.map((c) => {
              const name = c.name || c.username || "Guide";
              const initials = name.charAt(0).toUpperCase();
              const rate = c.perMinuteRate ?? 50;
              const services = (c.service_slugs ?? []).slice(0, 3);

              return (
                <Link
                  key={c.id}
                  href={`/consultant/${c.id}`}
                  className="group block p-5 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-purple-500/40 hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] flex items-center justify-center text-white font-black text-lg">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt={name} className="w-full h-full object-cover" />
                        ) : initials}
                      </div>
                      {c.is_online && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full">
                          <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white text-sm truncate">{name}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider truncate">
                        {(c.category ?? "consultant").toLowerCase().replace(/_/g, " ")}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <span className="text-amber-400">⭐ {(c.rating ?? 0).toFixed(1)}</span>
                        <span className="text-orange-400 text-[10px]">
                          🔥 {(c.sparkScore ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {c.bio && (
                    <p className="text-xs text-slate-400 line-clamp-2 mb-3">{c.bio}</p>
                  )}

                  {services.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {services.map((slug) => (
                        <span
                          key={slug}
                          className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold uppercase tracking-wider"
                        >
                          {slug.replace(/-/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1 text-[10px] font-bold">
                      {c.is_online ? (
                        <>
                          <Radio size={10} className="text-emerald-400 animate-pulse" />
                          <span className="text-emerald-400 uppercase tracking-wider">Live</span>
                        </>
                      ) : (
                        <span className="text-slate-500 uppercase tracking-wider">Offline</span>
                      )}
                    </div>
                    <span className="text-xs text-purple-400 font-mono font-bold">₹{rate}/min</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Trust footer */}
        <div className="text-center text-[11px] text-slate-600 flex items-center justify-center gap-2 pt-8">
          <ShieldCheck size={11} /> Every consultant is identity-verified
        </div>
      </div>
    </div>
  );
}
