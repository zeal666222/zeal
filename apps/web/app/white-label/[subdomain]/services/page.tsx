// ═══════════════════════════════════════════════════════════════════════════════
// White-Label Services — Industry-grade service listing
// ═══════════════════════════════════════════════════════════════════════════════
import { notFound } from "next/navigation";
import { createAdminClient } from "@zeal/database/server";
import Link from "next/link";
import {
  ArrowRight, MessageCircle, Phone, Video, Users,
  Clock, Shield, CheckCircle2,
} from "lucide-react";

interface Props {
  params: Promise<{ subdomain: string }>;
}

interface ConsultantRow {
  id: string;
  chatRate: number | null;
  audioRate: number | null;
  videoRate: number | null;
  physicalRate: number | null;
  perMinuteRate: number;
  category: string;
  availability: Record<string, unknown> | null;
  bufferMinutes: number | null;
  subdomainActive: boolean | null;
  user: {
    name: string | null;
    username: string;
    is_online: boolean;
  } | Array<{ name: string | null; username: string; is_online: boolean }>;
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default async function WhiteLabelServicesPage({ params }: Props) {
  const { subdomain } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("Consultant")
    .select(`
      id, "chatRate", "audioRate", "videoRate", "physicalRate",
      "perMinuteRate", category, availability, "bufferMinutes",
      "subdomainActive",
      user:User!userId(name, username, is_online)
    `)
    .eq("subdomain", subdomain)
    .eq("subdomainActive", true)
    .maybeSingle();

  if (error || !data) notFound();

  const row = data as unknown as ConsultantRow;
  const user = pickOne(row.user);
  if (!user) notFound();

  const displayName = user.name || user.username || "Consultant";

  const services = [
    {
      key: "chat",
      icon: MessageCircle,
      label: "Chat Consultation",
      desc: "Real-time text-based guidance. Ask questions and receive detailed written responses at your own pace.",
      rate: row.chatRate ?? row.perMinuteRate,
      color: "from-blue-500 to-cyan-400",
      features: ["Text-based", "Response within minutes", "Chat history saved", "Available 24/7"],
    },
    {
      key: "audio",
      icon: Phone,
      label: "Audio Call",
      desc: "Live voice consultation for deeper, more personal guidance. Speak directly and receive real-time insights.",
      rate: row.audioRate ?? Math.round(row.perMinuteRate * 1.5),
      color: "from-purple-500 to-pink-400",
      features: ["Voice call", "Real-time conversation", "Private & secure", "Flexible duration"],
    },
    {
      key: "video",
      icon: Video,
      label: "Video Consultation",
      desc: "Face-to-face video session for the most immersive experience. See expressions, share screens, and connect deeply.",
      rate: row.videoRate ?? row.perMinuteRate * 2,
      color: "from-amber-500 to-orange-400",
      features: ["HD video call", "Face-to-face", "Screen sharing", "Recording available"],
    },
    {
      key: "physical",
      icon: Users,
      label: "In-Person Session",
      desc: "Meet in person for a traditional, immersive consultation experience. Available by appointment only.",
      rate: row.physicalRate,
      color: "from-emerald-500 to-teal-400",
      features: ["In-person meeting", "Extended session", "Personalized setting", "By appointment"],
    },
  ];

  return (
    <div className="relative">
      {/* Hero */}
      <section className="pt-16 pb-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-500/[0.05] to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] mb-6">
            <Clock size={12} className="text-purple-400" />
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest">
              {user.is_online ? "Available Now" : "By Appointment"}
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
            Services by {displayName}
          </h1>
          <p className="text-lg text-white/40 max-w-xl mx-auto">
            Choose the consultation format that works best for you
          </p>
        </div>
      </section>

      {/* Service cards */}
      <section className="pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.key}
                  className="group relative p-8 rounded-3xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all"
                >
                  <div className="flex items-start gap-5">
                    <div className={`shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg`}>
                      <Icon size={24} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold text-white mb-2">{s.label}</h2>
                      <p className="text-sm text-white/40 leading-relaxed mb-4">{s.desc}</p>

                      {/* Features */}
                      <div className="grid grid-cols-2 gap-2 mb-6">
                        {s.features.map((f) => (
                          <div key={f} className="flex items-center gap-1.5">
                            <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                            <span className="text-xs text-white/50">{f}</span>
                          </div>
                        ))}
                      </div>

                      {/* Price + CTA */}
                      <div className="flex items-center justify-between">
                        <div>
                          {s.rate ? (
                            <span className="text-2xl font-black text-white">
                              ₹{s.rate}
                              <span className="text-sm font-normal text-white/30">/min</span>
                            </span>
                          ) : (
                            <span className="text-sm text-white/30">Contact for pricing</span>
                          )}
                        </div>
                        <Link
                          href={`/white-label/${subdomain}/book?service=${s.key}`}
                          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:scale-105 active:scale-95"
                          style={{ background: `linear-gradient(135deg, var(--wl-primary, #7c3aed), var(--wl-accent, #a855f7))` }}
                        >
                          Book <ArrowRight size={14} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trust badges */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-6">
            <div className="flex items-center gap-2 text-white/30">
              <Shield size={16} className="text-emerald-400/50" />
              <span className="text-xs font-medium">Secure Payments</span>
            </div>
            <div className="flex items-center gap-2 text-white/30">
              <Clock size={16} className="text-blue-400/50" />
              <span className="text-xs font-medium">Flexible Timing</span>
            </div>
            <div className="flex items-center gap-2 text-white/30">
              <CheckCircle2 size={16} className="text-purple-400/50" />
              <span className="text-xs font-medium">Verified Consultant</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export const dynamic = "force-dynamic";
