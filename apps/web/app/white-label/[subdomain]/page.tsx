// ═══════════════════════════════════════════════════════════════════════════════
// White-Label Home — Industry-grade consultant landing page
// ═══════════════════════════════════════════════════════════════════════════════
import { notFound } from "next/navigation";
import { createAdminClient } from "@zeal/database/server";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, Calendar, Clock, MessageCircle, Phone, Star, Video,
  Sparkles, Shield, Globe, Quote, CheckCircle2,
} from "lucide-react";

interface Props {
  params: Promise<{ subdomain: string }>;
}

interface ConsultantRow {
  id: string;
  userId: string;
  bio: string | null;
  specialties: string[] | null;
  languages: string[] | null;
  category: string;
  rating: number;
  totalConsultations: number;
  perMinuteRate: number;
  chatRate: number | null;
  audioRate: number | null;
  videoRate: number | null;
  subdomain: string | null;
  subdomainActive: boolean | null;
  user: {
    id: string;
    name: string | null;
    username: string;
    avatar: string | null;
    is_online: boolean;
  } | Array<{
    id: string;
    name: string | null;
    username: string;
    avatar: string | null;
    is_online: boolean;
  }>;
  page: {
    heroTitle: string | null;
    heroSubtitle: string | null;
    heroImageUrl: string | null;
    coverImageUrl: string | null;
    aboutHeading: string | null;
    aboutBody: string | null;
    showServices: boolean;
    servicesHeading: string | null;
    showTestimonials: boolean;
    testimonialsHeading: string | null;
    showContact: boolean;
    contactWhatsapp: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    themeConfig: Record<string, unknown> | null;
  } | null | Array<{
    heroTitle: string | null;
    heroSubtitle: string | null;
    heroImageUrl: string | null;
    coverImageUrl: string | null;
    aboutHeading: string | null;
    aboutBody: string | null;
    showServices: boolean;
    servicesHeading: string | null;
    showTestimonials: boolean;
    testimonialsHeading: string | null;
    showContact: boolean;
    contactWhatsapp: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    themeConfig: Record<string, unknown> | null;
  }>;
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default async function WhiteLabelHomePage({ params }: Props) {
  const { subdomain } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("Consultant")
    .select(`
      id, userId, bio, specialties, languages, category, rating,
      "totalConsultations", "perMinuteRate", "chatRate", "audioRate",
      "videoRate", subdomain, "subdomainActive",
      user:User!userId(id, name, username, avatar, is_online),
      page:ConsultantPage(
        "heroTitle", "heroSubtitle", "heroImageUrl", "coverImageUrl",
        "aboutHeading", "aboutBody", "showServices", "servicesHeading",
        "showTestimonials", "testimonialsHeading", "showContact",
        "contactWhatsapp", "contactEmail", "contactPhone", "themeConfig"
      )
    `)
    .eq("subdomain", subdomain)
    .eq("subdomainActive", true)
    .maybeSingle();

  if (error || !data) notFound();

  const row = data as unknown as ConsultantRow;
  const user = pickOne(row.user);
  const page = pickOne(row.page);
  if (!user) notFound();

  const displayName = user.name || user.username || "Consultant";
  const heroTitle = page?.heroTitle || `Welcome to ${displayName}'s Practice`;
  const heroSubtitle = page?.heroSubtitle || row.bio || `Expert ${row.category.toLowerCase().replace(/_/g, " ")} consultation`;
  const aboutHeading = page?.aboutHeading || `About ${displayName}`;
  const aboutBody = page?.aboutBody || row.bio || "";
  const servicesHeading = page?.servicesHeading || "Services";
  const testimonialsHeading = page?.testimonialsHeading || "What Clients Say";

  const services = [
    { key: "chat", icon: MessageCircle, label: "Chat Consultation", desc: "Real-time text guidance", rate: row.chatRate ?? row.perMinuteRate, color: "from-blue-500 to-cyan-400" },
    { key: "audio", icon: Phone, label: "Audio Call", desc: "Live voice session", rate: row.audioRate ?? Math.round(row.perMinuteRate * 1.5), color: "from-purple-500 to-pink-400" },
    { key: "video", icon: Video, label: "Video Call", desc: "Face-to-face consultation", rate: row.videoRate ?? row.perMinuteRate * 2, color: "from-amber-500 to-orange-400" },
  ];

  // Fetch reviews
  const { data: reviewsRaw } = await admin
    .from("Booking")
    .select('rating, review, "updatedAt", user:User!userId(name, avatar)')
    .eq("consultantId", row.id)
    .eq("status", "COMPLETED")
    .not("rating", "is", null)
    .order("updatedAt", { ascending: false })
    .limit(6);

  const reviews = (reviewsRaw ?? []).map((r: { rating: number | null; review: string | null; user: unknown }) => {
    const reviewer = pickOne(r.user as { name: string | null; avatar: string | null } | Array<{ name: string | null; avatar: string | null }> | null);
    return {
      rating: r.rating,
      review: r.review,
      reviewerName: reviewer?.name ?? "Anonymous",
      reviewerAvatar: reviewer?.avatar,
    };
  });

  return (
    <div className="relative">
      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0" style={{ background: "var(--wl-hero-gradient, linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%))" }} />
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `radial-gradient(ellipse at 20% 50%, rgba(124,58,237,0.3) 0%, transparent 50%),
                            radial-gradient(ellipse at 80% 20%, rgba(168,85,247,0.2) 0%, transparent 50%),
                            radial-gradient(ellipse at 50% 80%, rgba(99,102,241,0.15) 0%, transparent 50%)`,
        }} />
        {page?.coverImageUrl && (
          <div className="absolute inset-0 opacity-20">
            <Image src={page.coverImageUrl} alt="" fill className="object-cover" sizes="100vw" priority />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a1a]/50 to-[#0a0a1a]" />

        {/* Content */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
            {/* Left: text */}
            <div className="flex-1 text-center lg:text-left">
              {user.is_online && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Available Now</span>
                </div>
              )}

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.1] mb-6">
                {heroTitle}
              </h1>
              <p className="text-lg sm:text-xl text-white/60 max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
                {heroSubtitle}
              </p>

              {/* Stats row */}
              <div className="flex items-center justify-center lg:justify-start gap-6 mb-8">
                <div className="flex items-center gap-1.5">
                  <Star size={16} className="fill-amber-400 text-amber-400" />
                  <span className="text-sm font-bold text-white">{row.rating.toFixed(1)}</span>
                  <span className="text-xs text-white/40">rating</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-purple-400" />
                  <span className="text-sm font-bold text-white">{row.totalConsultations}</span>
                  <span className="text-xs text-white/40">sessions</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-400" />
                  <span className="text-sm font-bold text-white">
                    {row.specialties?.length ?? 0}
                  </span>
                  <span className="text-xs text-white/40">specialties</span>
                </div>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
                <Link
                  href={`/white-label/${subdomain}/book`}
                  className="group px-8 py-4 rounded-2xl font-bold text-white transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-2xl shadow-purple-500/20"
                  style={{ background: `linear-gradient(135deg, var(--wl-primary, #7c3aed), var(--wl-accent, #a855f7))` }}
                >
                  Book a Session
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <a
                  href={`#services`}
                  className="px-8 py-4 rounded-2xl font-bold text-white/70 border border-white/10 hover:border-white/20 hover:text-white transition-all"
                >
                  View Services
                </a>
              </div>
            </div>

            {/* Right: avatar card */}
            <div className="shrink-0">
              <div className="relative">
                <div className="absolute -inset-4 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 blur-2xl" />
                <div className="relative w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 rounded-full overflow-hidden ring-4 ring-white/10 shadow-2xl">
                  {user.avatar ? (
                    <Image src={user.avatar} alt={displayName} fill sizes="256px" className="object-cover" priority />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-6xl font-black">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                {user.is_online && (
                  <div className="absolute bottom-4 right-4 w-6 h-6 rounded-full bg-emerald-500 border-4 border-[#0a0a1a] animate-pulse" />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ ABOUT ═══ */}
      {aboutBody && (
        <section className="py-16 sm:py-24 relative">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] mb-6">
              <Shield size={12} className="text-purple-400" />
              <span className="text-xs font-bold text-white/40 uppercase tracking-widest">About</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">{aboutHeading}</h2>
            <p className="text-lg text-white/50 leading-relaxed max-w-2xl mx-auto">{aboutBody}</p>

            {/* Specialties + Languages */}
            <div className="flex flex-wrap justify-center gap-2 mt-8">
              {(row.specialties ?? []).map((s) => (
                <span key={s} className="px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-sm text-purple-300 font-medium">
                  {s}
                </span>
              ))}
              {(row.languages ?? []).map((l) => (
                <span key={l} className="px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] text-sm text-white/40">
                  {l}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ SERVICES ═══ */}
      {page?.showServices !== false && (
        <section id="services" className="py-16 sm:py-24 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/[0.02] to-transparent" />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">{servicesHeading}</h2>
              <p className="text-white/40">Choose your preferred consultation format</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {services.map((s) => {
                const Icon = s.icon;
                return (
                  <Link
                    key={s.key}
                    href={`/white-label/${subdomain}/book?service=${s.key}`}
                    className="group relative p-8 rounded-3xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all hover:-translate-y-1"
                  >
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                      <Icon size={24} className="text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{s.label}</h3>
                    <p className="text-sm text-white/40 mb-6">{s.desc}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-black text-white">
                        ₹{s.rate}<span className="text-sm font-normal text-white/30">/min</span>
                      </span>
                      <span className="flex items-center gap-1 text-sm font-bold text-purple-400 group-hover:text-purple-300 transition-colors">
                        Book <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══ TESTIMONIALS ═══ */}
      {page?.showTestimonials !== false && reviews.length > 0 && (
        <section className="py-16 sm:py-24 relative">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">{testimonialsHeading}</h2>
              <p className="text-white/40">Real experiences from real clients</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reviews.map((r: { rating: number | null; review: string | null; reviewerName: string; reviewerAvatar: string | null }, i: number) => (
                <div key={i} className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.06]">
                  <Quote size={20} className="text-purple-400/40 mb-4" />
                  <p className="text-sm text-white/60 leading-relaxed mb-4">
                    {r.review || "Great session!"}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center text-xs font-bold text-purple-300">
                      {r.reviewerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{r.reviewerName}</p>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, si) => (
                          <Star key={si} size={10} className={si < (r.rating ?? 5) ? "fill-amber-400 text-amber-400" : "text-white/10"} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ CTA ═══ */}
      <section className="py-16 sm:py-24 relative">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="p-10 sm:p-14 rounded-[2rem] bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-purple-500/10 blur-[100px]" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-indigo-500/10 blur-[100px]" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                Ready to Begin Your Journey?
              </h2>
              <p className="text-white/50 mb-8 max-w-lg mx-auto">
                Book a session with {displayName} and get personalized guidance for your path ahead.
              </p>
              <Link
                href={`/white-label/${subdomain}/book`}
                className="inline-flex items-center gap-2 px-10 py-4 rounded-2xl font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-purple-500/20"
                style={{ background: `linear-gradient(135deg, var(--wl-primary, #7c3aed), var(--wl-accent, #a855f7))` }}
              >
                <Calendar size={20} />
                Book a Session
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export const dynamic = "force-dynamic";
