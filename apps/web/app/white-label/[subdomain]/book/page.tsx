// ═══════════════════════════════════════════════════════════════════════════════
// White-Label Book — Industry-grade booking page
// ═══════════════════════════════════════════════════════════════════════════════
import { notFound } from "next/navigation";
import { createAdminClient } from "@zeal/database/server";
import Link from "next/link";
import { Calendar, Clock, ArrowRight, Shield, Star } from "lucide-react";

interface Props {
  params: Promise<{ subdomain: string }>;
}

interface ConsultantRow {
  id: string;
  perMinuteRate: number;
  chatRate: number | null;
  audioRate: number | null;
  videoRate: number | null;
  category: string;
  rating: number;
  totalConsultations: number;
  subdomainActive: boolean | null;
  user: {
    name: string | null;
    username: string;
    avatar: string | null;
    is_online: boolean;
  } | Array<{
    name: string | null;
    username: string;
    avatar: string | null;
    is_online: boolean;
  }>;
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default async function WhiteLabelBookPage({ params }: Props) {
  const { subdomain } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("Consultant")
    .select(`
      id, "perMinuteRate", "chatRate", "audioRate", "videoRate",
      category, rating, "totalConsultations", "subdomainActive",
      user:User!userId(name, username, avatar, is_online)
    `)
    .eq("subdomain", subdomain)
    .eq("subdomainActive", true)
    .maybeSingle();

  if (error || !data) notFound();

  const row = data as unknown as ConsultantRow;
  const user = pickOne(row.user);
  if (!user) notFound();

  const displayName = user.name || user.username || "Consultant";
  const loginHref = "/login?redirect=" + encodeURIComponent(`/white-label/${subdomain}/book`);

  return (
    <div className="relative min-h-[calc(100dvh-4rem)]">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-500/[0.03] to-transparent" />

      <div className="relative max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] mb-6">
            <Calendar size={12} className="text-purple-400" />
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Book Session</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Book with {displayName}
          </h1>
          <p className="text-white/40">
            Choose a service, pick a time, and pay securely
          </p>
        </div>

        {/* Consultant card */}
        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.06] mb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-black overflow-hidden">
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>
              {user.is_online && (
                <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0a0a1a]" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{displayName}</h2>
              <p className="text-sm text-white/40">{row.category.replace(/_/g, " ")}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-sm text-amber-400">
                  <Star size={12} className="fill-amber-400" /> {row.rating.toFixed(1)}
                </span>
                <span className="text-xs text-white/30">{row.totalConsultations} sessions</span>
              </div>
            </div>
          </div>
        </div>

        {/* Auth gate */}
        <div className="p-10 rounded-3xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 text-center relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-purple-500/10 blur-[100px]" />
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-white/[0.05] flex items-center justify-center mx-auto mb-6">
              <Calendar size={28} className="text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Sign in to Book</h3>
            <p className="text-sm text-white/40 mb-8 max-w-sm mx-auto">
              Create an account or sign in to schedule your session with {displayName}.
              Payments are secure and encrypted.
            </p>
            <Link
              href={loginHref}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-purple-500/20"
              style={{ background: `linear-gradient(135deg, var(--wl-primary, #7c3aed), var(--wl-accent, #a855f7))` }}
            >
              Sign in to Continue
              <ArrowRight size={18} />
            </Link>
            <div className="flex items-center justify-center gap-4 mt-6">
              <div className="flex items-center gap-1.5 text-white/20">
                <Shield size={12} />
                <span className="text-xs">Secure</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/20">
                <Clock size={12} />
                <span className="text-xs">Instant</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
