// ═══════════════════════════════════════════════════════════════════════════════
// /explore — editorial discovery
// ═══════════════════════════════════════════════════════════════════════════════

import { createServerClientFromCookies } from "@zeal/database/server";
import { Compass, ShieldCheck, Sparkles } from "lucide-react";
import { ConsultantDirectory } from "./ConsultantDirectory";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface MvRow {
  id: string; userId: string; name: string | null; username: string | null;
  avatar_url: string | null; is_online: boolean; lastSeenAt: string | null;
  category: string | null; perMinuteRate: number | null; rating: number | null;
  sparkScore: number | null; isVerified: boolean | null; isActive: boolean | null;
  status: string | null; subdomain: string | null; subdomainActive: boolean | null;
  specialties: string[] | null; languages: string[] | null; bio: string | null;
  totalConsultations: number | null; service_slugs: string[] | null; category_ids: string[] | null;
}

async function loadDirectory(): Promise<MvRow[]> {
  try {
    const supabase = await createServerClientFromCookies();
    const { data, error } = await supabase.rpc("search_consultants", {
      p_filters: { limit: 60, sort: "relevance" },
    });
    if (error) return [];
    return ((data ?? {}) as { consultants?: MvRow[] }).consultants ?? [];
  } catch {
    return [];
  }
}

export default async function ExplorePage() {
  const consultants = await loadDirectory();
  const onlineCount = consultants.filter((c) => c.is_online).length;

  return (
    <div className="min-h-screen-app bg-background text-foreground pb-24">
      {/* ─── Editorial hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden noise-overlay
                          border-b border-[var(--color-luxury-glass-border)]">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px]
                        bg-[var(--color-primary)]/[0.14] blur-[180px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px]
                        bg-[var(--color-luxury-gold)]/[0.10] blur-[180px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 lg:px-16
                        py-14 md:py-20">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full
                          bg-[var(--color-luxury-gold)]/[0.08]
                          border border-[var(--color-luxury-gold)]/[0.20]
                          text-[var(--color-luxury-gold)]
                          text-[10px] font-black uppercase tracking-[0.25em] mb-6">
            <Compass size={12} /> Discovery
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black
                         tracking-[-0.03em] leading-[0.95] text-foreground
                         max-w-3xl">
            Find your{" "}
            <span className="text-luxury-gradient">sanctuary.</span>
          </h1>

          <p className="mt-6 text-base md:text-lg text-muted-foreground
                        max-w-2xl leading-relaxed">
            {consultants.length.toLocaleString("en-IN")} verified guides across every
            tradition.{" "}
            {onlineCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {onlineCount} online now
              </span>
            )}
          </p>

          {/* trust footer */}
          <div className="mt-8 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-emerald-400" />
              Identity-verified
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles size={12} className="text-[var(--color-luxury-gold)]" />
              Escrow-protected
            </span>
          </div>
        </div>
      </section>

      {/* ─── Client directory ────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-16 py-10">
        <ConsultantDirectory initialConsultants={consultants} />
      </div>
    </div>
  );
}
