"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// FreeServicesGrid — premium glassmorphism showcase of all free AI services
// ═══════════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Moon,
  Sparkles,
  Hash,
  Hand,
  Eye,
  Compass,
  ArrowRight,
  Zap,
} from "lucide-react";
import { staggerContainer, fadeUp } from "@zeal/ui/motion";

interface ServiceCard {
  slug: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
  gradient: string;
  glow: string;
  tag: string;
}

const FREE_SERVICES: ServiceCard[] = [
  {
    slug: "/services/tarot",
    title: "Tarot Reading",
    description: "Gamified card draws with animated spreads and AI-guided interpretation.",
    icon: Moon,
    gradient: "from-indigo-500/20 via-purple-500/15 to-violet-600/20",
    glow: "bg-indigo-500/20",
    tag: "Most Popular",
  },
  {
    slug: "/services/horoscope",
    title: "Horoscope",
    description: "Daily, weekly & monthly horoscopes personalized to your birth chart.",
    icon: Sparkles,
    gradient: "from-amber-500/20 via-orange-500/15 to-yellow-500/20",
    glow: "bg-amber-500/20",
    tag: "Daily",
  },
  {
    slug: "/services/numerology",
    title: "Numerology",
    description: "Life path, destiny & name numbers decoded with Vedic and Pythagorean systems.",
    icon: Hash,
    gradient: "from-cyan-500/20 via-teal-500/15 to-emerald-500/20",
    glow: "bg-cyan-500/20",
    tag: "Vedic + Western",
  },
  {
    slug: "/services/kundali",
    title: "Kundali",
    description: "Complete birth chart analysis with dasha periods, yogas & planetary positions.",
    icon: Compass,
    gradient: "from-rose-500/20 via-pink-500/15 to-fuchsia-500/20",
    glow: "bg-rose-500/20",
    tag: "Birth Chart",
  },
  {
    slug: "/services/palmistry",
    title: "Palmistry",
    description: "Upload a palm photo for AI analysis of life, heart, head & fate lines.",
    icon: Hand,
    gradient: "from-emerald-500/20 via-green-500/15 to-lime-500/20",
    glow: "bg-emerald-500/20",
    tag: "Image AI",
  },
  {
    slug: "/services/dream",
    title: "Dream Interpretation",
    description: "Jungian archetypes, symbol dictionaries & collective unconscious analysis.",
    icon: Eye,
    gradient: "from-violet-500/20 via-purple-500/15 to-indigo-500/20",
    glow: "bg-violet-500/20",
    tag: "New",
  },
];

export function FreeServicesGrid() {
  return (
    <section className="relative">
      {/* Section header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Zap size={10} className="text-emerald-400" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400">
              100% Free
            </span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-luxury-gold)]">
            AI-Powered
          </span>
        </div>
        <h2 className="text-2xl md:text-4xl font-black tracking-tight text-foreground">
          Free AI Services
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          Six powerful AI services — no signup walls, no hidden charges. Instant readings powered by Groq.
        </p>
      </div>

      {/* Grid */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5"
      >
        {FREE_SERVICES.map((service, i) => {
          const Icon = service.icon;
          return (
            <motion.div key={service.slug} variants={fadeUp}>
              <Link href={service.slug} className="group block h-full">
                <div
                  className="relative h-full overflow-hidden rounded-3xl glass-luxury p-6
                             transition-all duration-500 group-hover:scale-[1.02]"
                >
                  {/* Gradient background */}
                  <div
                    aria-hidden
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${service.gradient} opacity-60 group-hover:opacity-100 transition-opacity duration-500`}
                  />

                  {/* Hover glow */}
                  <div
                    aria-hidden
                    className={`pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full ${service.glow} blur-3xl opacity-0 group-hover:opacity-60 transition-opacity duration-700`}
                  />

                  {/* Content */}
                  <div className="relative z-10 flex flex-col h-full">
                    {/* Top row: tag + icon */}
                    <div className="flex items-start justify-between mb-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full
                                       bg-white/[0.06] border border-white/[0.10]
                                       text-[9px] font-black uppercase tracking-[0.15em]
                                       text-foreground/70">
                        {service.tag}
                      </span>
                      <div
                        className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${service.gradient}
                                    flex items-center justify-center
                                    group-hover:scale-110 transition-transform duration-500`}
                      >
                        <Icon size={22} className="text-foreground/80" />
                      </div>
                    </div>

                    {/* Title + description */}
                    <h3 className="text-lg font-black text-foreground mb-2 group-hover:text-[var(--color-luxury-gold)] transition-colors">
                      {service.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                      {service.description}
                    </p>

                    {/* CTA */}
                    <div className="mt-5 flex items-center gap-1.5 text-xs font-bold text-[var(--color-luxury-gold)] opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300">
                      Start reading <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Bottom CTA */}
      <div className="mt-8 text-center">
        <Link
          href="/services"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-[var(--color-luxury-gold)] transition-colors"
        >
          View all 37+ service categories <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}
