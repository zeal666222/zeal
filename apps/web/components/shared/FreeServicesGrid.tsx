"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// FreeServicesGrid — industry-grade showcase of Zeal's free AI services.
//
// Each card pairs a hero banner (next/image, optimized by Next) with a hand-
// drawn SVG infographic that visually explains the service at a glance:
//   Tarot         → three-card spread
//   Horoscope     → 12-spoke zodiac wheel
//   Numerology    → 3×3 Lo Shu grid
//   Kundali       → North Indian diamond chart
//   Guna Milan    → two kundalis joined by 8 Ashtakoot threads
//   Palmistry     → hand outline with 4 major lines
//   Panchang      → 5-segment dial with sun + moon
//   Dream         → crescent moon with sleeping eye
//
// Palette follows the brand celestial-Z tokens in packages/ui/src/brand so
// cards feel like part of the same product, not generic Tailwind gradients.
// ═══════════════════════════════════════════════════════════════════════════════

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Zap, Star, Clock } from "lucide-react";
import { staggerContainer, fadeUp } from "@zeal/ui/motion";

// ─── Infographic SVG components ───────────────────────────────────────────────
// Each is a self-contained SVG that scales to any container via viewBox.
// Stroke width and gradient stops are tuned to look correct at ~64px and ~200px.

type SvgProps = { className?: string; strokeWidth?: number };

function TarotInfo({ className, strokeWidth = 1.4 }: SvgProps) {
  return (
    <svg viewBox="0 0 220 140" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="ti-card" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#533afd" stopOpacity="0.20" />
        </linearGradient>
      </defs>
      {/* past card */}
      <g transform="translate(30 30) rotate(-14 30 40)">
        <rect x="0" y="0" width="60" height="80" rx="6" fill="url(#ti-card)" stroke="#d4af37" strokeOpacity="0.55" strokeWidth={strokeWidth} />
        <text x="30" y="46" textAnchor="middle" fill="#d4af37" fontSize="16" fontWeight="800" fontFamily="serif">I</text>
      </g>
      {/* present card (center, upright, taller) */}
      <g transform="translate(80 18)">
        <rect x="0" y="0" width="60" height="104" rx="7" fill="url(#ti-card)" stroke="#d4af37" strokeOpacity="0.85" strokeWidth={strokeWidth + 0.4} />
        <text x="30" y="60" textAnchor="middle" fill="#d4af37" fontSize="20" fontWeight="900" fontFamily="serif">II</text>
      </g>
      {/* future card */}
      <g transform="translate(130 30) rotate(14 30 40)">
        <rect x="0" y="0" width="60" height="80" rx="6" fill="url(#ti-card)" stroke="#d4af37" strokeOpacity="0.55" strokeWidth={strokeWidth} />
        <text x="30" y="46" textAnchor="middle" fill="#d4af37" fontSize="16" fontWeight="800" fontFamily="serif">III</text>
      </g>
      {/* base glow */}
      <ellipse cx="110" cy="130" rx="70" ry="3" fill="#c4b5fd" fillOpacity="0.18" />
    </svg>
  );
}

function HoroscopeInfo({ className, strokeWidth = 1.2 }: SvgProps) {
  const signs = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
  // Round the trig outputs to a fixed precision — bare Math.sin/cos produce
  // values like 29.444863728670914 on the server and 29.44486372867091 on
  // the client (float serialization diverges between React's server-renderer
  // and the DOM attribute setter), which trips a hydration mismatch on every
  // homepage load. .toFixed() gives both sides the identical string.
  const n = (v: number) => Number(v.toFixed(3));
  return (
    <svg viewBox="0 0 220 140" className={className} fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="hi-core" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#d4af37" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform="translate(110 70)">
        {/* outer wheel */}
        <circle r="55" stroke="#c4b5fd" strokeOpacity="0.55" strokeWidth={strokeWidth} />
        <circle r="34" stroke="#9d7dc5" strokeOpacity="0.55" strokeWidth={strokeWidth} />
        {/* 12 spokes + glyphs */}
        {signs.map((s, i) => {
          const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const x1 = n(Math.cos(angle) * 34);
          const y1 = n(Math.sin(angle) * 34);
          const x2 = n(Math.cos(angle) * 55);
          const y2 = n(Math.sin(angle) * 55);
          const tx = n(Math.cos(angle) * 45);
          const ty = n(Math.sin(angle) * 45);
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c4b5fd" strokeOpacity="0.35" strokeWidth={strokeWidth} />
              <text x={tx} y={ty + 4} textAnchor="middle" fill="#c4b5fd" fontSize="9" fontWeight="700">{s}</text>
            </g>
          );
        })}
        {/* core sun */}
        <circle r="16" fill="url(#hi-core)" />
        <circle r="8" stroke="#d4af37" strokeOpacity="0.9" strokeWidth={strokeWidth + 0.4} />
        <circle r="2.5" fill="#d4af37" />
      </g>
    </svg>
  );
}

function NumerologyInfo({ className, strokeWidth = 1 }: SvgProps) {
  // Lo Shu magic square: 4 9 2 / 3 5 7 / 8 1 6
  const cells: Array<{ r: number; c: number; n: number }> = [
    { r: 0, c: 0, n: 4 }, { r: 0, c: 1, n: 9 }, { r: 0, c: 2, n: 2 },
    { r: 1, c: 0, n: 3 }, { r: 1, c: 1, n: 5 }, { r: 1, c: 2, n: 7 },
    { r: 2, c: 0, n: 8 }, { r: 2, c: 1, n: 1 }, { r: 2, c: 2, n: 6 },
  ];
  return (
    <svg viewBox="0 0 220 140" className={className} fill="none" aria-hidden="true">
      <g transform="translate(70 20)">
        {cells.map(({ r, c, n }) => {
          const x = c * 30;
          const y = r * 30;
          const isCore = n === 5;
          return (
            <g key={`${r}-${c}`}>
              <rect
                x={x}
                y={y}
                width="30"
                height="30"
                rx="4"
                fill={isCore ? "#d4af37" : "#c4b5fd"}
                fillOpacity={isCore ? 0.22 : 0.08}
                stroke={isCore ? "#d4af37" : "#9d7dc5"}
                strokeOpacity={isCore ? 0.9 : 0.45}
                strokeWidth={strokeWidth + (isCore ? 0.4 : 0)}
              />
              <text
                x={x + 15}
                y={y + 20}
                textAnchor="middle"
                fill={isCore ? "#d4af37" : "#c4b5fd"}
                fontSize="14"
                fontWeight="900"
              >
                {n}
              </text>
            </g>
          );
        })}
      </g>
      {/* connecting magic-line to 5 */}
      <line x1="85" y1="112" x2="135" y2="112" stroke="#d4af37" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="2 3" />
      <text x="110" y="128" textAnchor="middle" fill="#d4af37" fontSize="8" fontWeight="800" letterSpacing="0.15em">SUM = 15</text>
    </svg>
  );
}

function KundaliInfo({ className, strokeWidth = 1 }: SvgProps) {
  // North Indian diamond chart: outer square + rotated square + 4 inner lines
  return (
    <svg viewBox="0 0 220 140" className={className} fill="none" aria-hidden="true">
      <g transform="translate(110 70)">
        <rect x="-52" y="-52" width="104" height="104" rx="3" stroke="#c4b5fd" strokeOpacity="0.55" strokeWidth={strokeWidth + 0.3} />
        <polygon points="0,-52 52,0 0,52 -52,0" stroke="#9d7dc5" strokeOpacity="0.7" strokeWidth={strokeWidth + 0.3} />
        <line x1="-52" y1="-52" x2="52" y2="52" stroke="#9d7dc5" strokeOpacity="0.5" strokeWidth={strokeWidth} />
        <line x1="52" y1="-52" x2="-52" y2="52" stroke="#9d7dc5" strokeOpacity="0.5" strokeWidth={strokeWidth} />
        {/* house glyphs at cardinal points */}
        <text x="0" y="-32" textAnchor="middle" fill="#d4af37" fontSize="9" fontWeight="900">1</text>
        <text x="30" y="4" textAnchor="middle" fill="#c4b5fd" fontSize="8" fontWeight="700">3</text>
        <text x="0" y="42" textAnchor="middle" fill="#c4b5fd" fontSize="8" fontWeight="700">7</text>
        <text x="-30" y="4" textAnchor="middle" fill="#c4b5fd" fontSize="8" fontWeight="700">11</text>
        {/* ascendant dot */}
        <circle cx="0" cy="-52" r="3" fill="#d4af37" />
      </g>
    </svg>
  );
}

function MilanInfo({ className, strokeWidth = 1 }: SvgProps) {
  // Two kundali diamonds joined by 8 Ashtakoot threads into a heart
  return (
    <svg viewBox="0 0 220 140" className={className} fill="none" aria-hidden="true">
      <g transform="translate(50 70)">
        <rect x="-24" y="-24" width="48" height="48" rx="2" stroke="#c4b5fd" strokeOpacity="0.6" strokeWidth={strokeWidth} />
        <polygon points="0,-24 24,0 0,24 -24,0" stroke="#9d7dc5" strokeOpacity="0.7" strokeWidth={strokeWidth} />
      </g>
      <g transform="translate(170 70)">
        <rect x="-24" y="-24" width="48" height="48" rx="2" stroke="#f9a8d4" strokeOpacity="0.6" strokeWidth={strokeWidth} />
        <polygon points="0,-24 24,0 0,24 -24,0" stroke="#ec4899" strokeOpacity="0.7" strokeWidth={strokeWidth} />
      </g>
      {/* 8 threads converging at center */}
      {[-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5].map((off, i) => (
        <path
          key={i}
          d={`M74 ${70 + off} Q110 ${70 + off * 4} 146 ${70 + off}`}
          stroke="#d4af37"
          strokeOpacity={0.35 + i * 0.06}
          strokeWidth={0.8}
          fill="none"
        />
      ))}
      {/* heart at center */}
      <path
        d="M110 82 C102 74 96 68 96 62 C96 57 100 54 104 54 C107 54 109 56 110 58 C111 56 113 54 116 54 C120 54 124 57 124 62 C124 68 118 74 110 82 Z"
        fill="#d4af37"
        fillOpacity="0.9"
      />
      <text x="110" y="120" textAnchor="middle" fill="#d4af37" fontSize="10" fontWeight="900" letterSpacing="0.1em">36 GUN</text>
    </svg>
  );
}

function PalmistryInfo({ className, strokeWidth = 1.2 }: SvgProps) {
  return (
    <svg viewBox="0 0 220 140" className={className} fill="none" aria-hidden="true">
      {/* stylised palm outline */}
      <path
        d="M75 128 Q60 108 60 82 Q60 60 68 46 Q72 40 76 42 Q80 44 82 52 L85 68 L85 34 Q85 28 90 28 Q95 28 95 34 L95 66 L98 30 Q98 24 103 24 Q108 24 108 30 L108 66 L112 32 Q112 26 117 26 Q122 26 122 32 L122 72 L128 44 Q130 38 135 40 Q140 42 140 50 L140 90 Q140 116 128 130 Z"
        stroke="#c4b5fd"
        strokeOpacity="0.75"
        strokeWidth={strokeWidth}
        fill="#c4b5fd"
        fillOpacity="0.06"
      />
      {/* life line */}
      <path d="M92 62 Q78 88 82 116" stroke="#d4af37" strokeOpacity="0.9" strokeWidth={strokeWidth + 0.4} fill="none" />
      {/* head line */}
      <path d="M88 78 Q108 82 128 76" stroke="#f9a8d4" strokeOpacity="0.9" strokeWidth={strokeWidth + 0.2} fill="none" />
      {/* heart line */}
      <path d="M92 60 Q110 55 128 62" stroke="#a78bfa" strokeOpacity="0.9" strokeWidth={strokeWidth + 0.2} fill="none" />
      {/* fate line */}
      <path d="M105 118 Q108 90 110 60" stroke="#5eead4" strokeOpacity="0.85" strokeWidth={strokeWidth} fill="none" />
    </svg>
  );
}

function PanchangInfo({ className, strokeWidth = 1.2 }: SvgProps) {
  const limbs = ["Tithi", "Karana", "Yoga", "Nakshatra", "Vara"];
  return (
    <svg viewBox="0 0 220 140" className={className} fill="none" aria-hidden="true">
      <g transform="translate(110 68)">
        {/* 5-segment dial */}
        {limbs.map((limb, i) => {
          const start = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const end = ((i + 1) / 5) * Math.PI * 2 - Math.PI / 2;
          const x1 = Math.cos(start) * 46;
          const y1 = Math.sin(start) * 46;
          const x2 = Math.cos(end) * 46;
          const y2 = Math.sin(end) * 46;
          const mid = (start + end) / 2;
          const tx = Math.cos(mid) * 58;
          const ty = Math.sin(mid) * 58 + 3;
          return (
            <g key={i}>
              <path d={`M0 0 L${x1} ${y1} A46 46 0 0 1 ${x2} ${y2} Z`} fill="#c4b5fd" fillOpacity={0.06 + i * 0.03} stroke="#9d7dc5" strokeOpacity="0.5" strokeWidth={strokeWidth} />
              <text x={tx} y={ty} textAnchor="middle" fill="#c4b5fd" fontSize="7" fontWeight="800" letterSpacing="0.05em">{limb}</text>
            </g>
          );
        })}
        {/* sun + moon at center */}
        <circle cx="-9" cy="0" r="6" fill="#d4af37" fillOpacity="0.9" />
        <path d="M6 -6 A7 7 0 1 0 6 6 A5 5 0 1 1 6 -6 Z" fill="#c4b5fd" fillOpacity="0.9" />
      </g>
      {/* Rahu Kaal band */}
      <rect x="52" y="122" width="116" height="10" rx="3" fill="#ef4444" fillOpacity="0.15" stroke="#ef4444" strokeOpacity="0.55" strokeWidth={strokeWidth} />
      <text x="110" y="130" textAnchor="middle" fill="#ef4444" fontSize="7" fontWeight="900" letterSpacing="0.15em">RAHU KAAL</text>
    </svg>
  );
}

function DreamInfo({ className, strokeWidth = 1.2 }: SvgProps) {
  return (
    <svg viewBox="0 0 220 140" className={className} fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="dm-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="110" cy="70" r="60" fill="url(#dm-glow)" />
      {/* crescent moon */}
      <path
        d="M132 42 A34 34 0 1 0 132 98 A26 26 0 1 1 132 42 Z"
        fill="#c4b5fd"
        fillOpacity="0.85"
        stroke="#9d7dc5"
        strokeOpacity="0.6"
        strokeWidth={strokeWidth}
      />
      {/* closed eye on the moon */}
      <path d="M108 66 Q114 72 122 66" stroke="#533afd" strokeWidth={strokeWidth + 0.4} fill="none" strokeLinecap="round" />
      <path d="M110 71 L108 76 M116 73 L116 78 M122 71 L124 76" stroke="#533afd" strokeWidth={strokeWidth} strokeLinecap="round" />
      {/* stars */}
      {[
        { x: 60, y: 40, r: 1.8 },
        { x: 78, y: 30, r: 1.2 },
        { x: 55, y: 90, r: 1.5 },
        { x: 82, y: 106, r: 1.2 },
        { x: 158, y: 58, r: 1.4 },
        { x: 168, y: 88, r: 1.1 },
      ].map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#d4af37" fillOpacity="0.85" />
      ))}
      {/* Zzz trail */}
      <text x="146" y="52" fill="#c4b5fd" fontSize="12" fontWeight="900" opacity="0.85">z</text>
      <text x="156" y="42" fill="#c4b5fd" fontSize="10" fontWeight="900" opacity="0.6">z</text>
      <text x="164" y="34" fill="#c4b5fd" fontSize="8" fontWeight="900" opacity="0.4">z</text>
    </svg>
  );
}

// ─── Service definitions ──────────────────────────────────────────────────────

interface ServiceDef {
  slug: string;
  title: string;
  blurb: string;
  longBlurb: string;
  banner?: string;
  tag: string;
  accent: "indigo" | "amber" | "cyan" | "rose" | "pink" | "emerald" | "orange" | "violet";
  Info: (p: SvgProps) => React.ReactElement;
  stats: Array<{ label: string; value: string; icon?: React.ComponentType<{ size?: number; className?: string }> }>;
  inputLabel: string;
  outputLabel: string;
}

const ACCENT_HEX: Record<ServiceDef["accent"], { ring: string; glow: string; text: string }> = {
  indigo:  { ring: "rgba(99,102,241,0.55)",  glow: "rgba(99,102,241,0.35)",  text: "#c7d2fe" },
  amber:   { ring: "rgba(245,158,11,0.55)",  glow: "rgba(245,158,11,0.35)",  text: "#fde68a" },
  cyan:    { ring: "rgba(34,211,238,0.55)",  glow: "rgba(34,211,238,0.35)",  text: "#a5f3fc" },
  rose:    { ring: "rgba(244,63,94,0.55)",   glow: "rgba(244,63,94,0.35)",   text: "#fecdd3" },
  pink:    { ring: "rgba(236,72,153,0.55)",  glow: "rgba(236,72,153,0.35)",  text: "#fbcfe8" },
  emerald: { ring: "rgba(16,185,129,0.55)",  glow: "rgba(16,185,129,0.35)",  text: "#a7f3d0" },
  orange:  { ring: "rgba(249,115,22,0.55)",  glow: "rgba(249,115,22,0.35)",  text: "#fed7aa" },
  violet:  { ring: "rgba(139,92,246,0.55)",  glow: "rgba(139,92,246,0.35)",  text: "#ddd6fe" },
};

const SERVICES: ServiceDef[] = [
  {
    slug: "/services/tarot",
    title: "Tarot Reading",
    blurb: "Three-card past · present · future draws, animated reveals, AI interpretation of every arcana.",
    longBlurb: "Shuffle a 78-card Rider-Waite deck, lay past/present/future or full Celtic cross, and read reversals, element balance and pip-suit story arcs with an AI guide trained on golden-dawn commentary.",
    banner: "/services/tarot.png",
    tag: "Most Popular",
    accent: "indigo",
    Info: TarotInfo,
    stats: [
      { label: "Cards", value: "78" },
      { label: "Spreads", value: "5" },
      { label: "Time", value: "<60s" },
    ],
    inputLabel: "Your question",
    outputLabel: "Card-by-card narrative",
  },
  {
    slug: "/services/horoscope",
    title: "Daily Horoscope",
    blurb: "Rashfal for all 12 signs, personalised to your Moon sign and current gochara transits.",
    longBlurb: "Nirayana sidereal transits drive a text-and-tone forecast for love, career, health, finance and spiritual practice. Compare with Western tropical horoscope in the same view.",
    banner: "/services/horoscope.png",
    tag: "Daily",
    accent: "amber",
    Info: HoroscopeInfo,
    stats: [
      { label: "Signs", value: "12" },
      { label: "Refresh", value: "Daily" },
      { label: "Systems", value: "Vedic+W." },
    ],
    inputLabel: "Your Moon sign",
    outputLabel: "Day / week / month forecast",
  },
  {
    slug: "/services/numerology",
    title: "Numerology",
    blurb: "Life Path, Destiny, Soul Urge and Name numbers in Chaldean and Pythagorean systems.",
    longBlurb: "Reduce your birth date and full name through the Lo Shu magic square to reveal core numbers, personal year, challenge numbers and lucky digit windows for name changes and muhurats.",
    banner: "/services/numerology.png",
    tag: "Vedic + Western",
    accent: "cyan",
    Info: NumerologyInfo,
    stats: [
      { label: "Numbers", value: "9" },
      { label: "Systems", value: "2" },
      { label: "Time", value: "<30s" },
    ],
    inputLabel: "Name + birth date",
    outputLabel: "Life Path + remedies",
  },
  {
    slug: "/services/kundali",
    title: "Janam Kundali",
    blurb: "Complete North Indian birth chart — 12 bhavas, 9 grahas, dasha balance, yogas and doshas.",
    longBlurb: "Lagna, Chandra and Surya charts with Vimshottari dasha up to 120 years, 300+ yogas, Mangal/Kaal/Sarpal/Pitra doshas with cancellation rules, and remedy suggestions.",
    banner: "/services/kundali.png",
    tag: "Birth Chart",
    accent: "rose",
    Info: KundaliInfo,
    stats: [
      { label: "Houses", value: "12" },
      { label: "Planets", value: "9" },
      { label: "Yogas", value: "300+" },
    ],
    inputLabel: "Birth date · time · place",
    outputLabel: "Dasha + yoga + remedies",
  },
  {
    slug: "/services/milan",
    title: "Guna Milan",
    blurb: "The full 36-point Ashtakoot match — Varna to Nadi — plus Mangal dosha cancellation.",
    longBlurb: "Read both kundalis side by side, score Varna·Vashya·Tara·Yoni·Graha Maitri·Gana·Bhakoot·Nadi, apply Nadi and Mangal exceptions, then output a percentage match with relationship advice.",
    banner: "/services/milan.png",
    tag: "36 Points",
    accent: "pink",
    Info: MilanInfo,
    stats: [
      { label: "Kootas", value: "8" },
      { label: "Points", value: "36" },
      { label: "Min. match", value: "18" },
    ],
    inputLabel: "Both birth charts",
    outputLabel: "Score + Mangal check",
  },
  {
    slug: "/services/palmistry",
    title: "Palmistry",
    blurb: "Upload a palm photo — AI reads life line, head line, heart line, fate line and mounts.",
    longBlurb: "Computer vision isolates the four major lines, eight mounts and hand-shape element (Earth / Air / Fire / Water). Interpretation follows Chinese and Western chiromancy traditions.",
    tag: "Image AI",
    accent: "emerald",
    Info: PalmistryInfo,
    stats: [
      { label: "Lines", value: "4" },
      { label: "Mounts", value: "8" },
      { label: "Hands", value: "Both" },
    ],
    inputLabel: "Palm photo",
    outputLabel: "Line-by-line reading",
  },
  {
    slug: "/services/panchang",
    title: "Daily Panchang",
    blurb: "Tithi · Nakshatra · Yoga · Karana · Vara, calculated from your city's sunrise and sunset.",
    longBlurb: "Local-time panchang with Rahu Kaal, Yamagandam, Gulika and Abhijit Muhurat windows. Includes Paksha, Masa, Ritu, Samvat and Shaka Shaka era for auspicious-date selection.",
    tag: "Rahu Kaal",
    accent: "orange",
    Info: PanchangInfo,
    stats: [
      { label: "Limbs", value: "5" },
      { label: "Cities", value: "Any" },
      { label: "Updates", value: "Daily" },
    ],
    inputLabel: "Your city",
    outputLabel: "Muhurat + kaal windows",
  },
  {
    slug: "/services/dream",
    title: "Dream Interpretation",
    blurb: "Jungian archetypes and Vedic swapna shastra decode recurring and one-off dreams.",
    longBlurb: "Describe the dream in any language, and the AI maps symbols to Jung's collective-unconscious archetypes plus the 400-swapna Brihat Samhita catalogue, then suggests a journaling prompt.",
    tag: "New",
    accent: "violet",
    Info: DreamInfo,
    stats: [
      { label: "Symbols", value: "500+" },
      { label: "Schools", value: "2" },
      { label: "Languages", value: "Any" },
    ],
    inputLabel: "Describe your dream",
    outputLabel: "Archetype + meaning",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

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
          Eight flagship readings — no signup wall, no hidden charges, no card.
          Every result is grounded in real Vedic computation, not a template.
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
        {SERVICES.map((service, i) => {
          const accent = ACCENT_HEX[service.accent];
          const Info = service.Info;
          return (
            <motion.div key={service.slug} variants={fadeUp} whileTap={{ scale: 0.98 }}>
              <Link
                href={service.slug}
                className="group block h-full rounded-[26px] overflow-hidden relative bg-[color-mix(in_oklab,var(--color-background)_85%,transparent)] border border-[color-mix(in_oklab,var(--color-luxury-gold)_18%,transparent)] shadow-[0_10px_40px_-16px_rgba(0,0,0,0.45)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_60px_-16px_rgba(212,175,55,0.28)] hover:border-[color-mix(in_oklab,var(--color-luxury-gold)_38%,transparent)]"
              >
                {/* Hero — banner image OR full-bleed SVG infographic */}
                <div
                  aria-hidden
                  className="relative h-40 md:h-44 overflow-hidden bg-gradient-to-br from-[color-mix(in_oklab,var(--color-muted)_65%,transparent)] via-[color-mix(in_oklab,var(--color-background)_80%,transparent)] to-[color-mix(in_oklab,var(--color-muted)_45%,transparent)]"
                >
                  {service.banner ? (
                    <Image
                      src={service.banner}
                      alt={`${service.title} artwork`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      priority={i < 3}
                      className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"
                      quality={82}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-90">
                      <Info className="w-[70%] h-[70%] transition-transform duration-[900ms] group-hover:scale-105" />
                    </div>
                  )}

                  {/* tinted gradient veil so text overlays stay readable */}
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, color-mix(in oklab, var(--color-background) 92%, transparent) 0%, color-mix(in oklab, var(--color-background) 55%, transparent) 45%, color-mix(in oklab, var(--color-background) 15%, transparent) 100%)",
                    }}
                  />

                  {/* accent ring top-left when banner is present */}
                  {service.banner && (
                    <div
                      className="pointer-events-none absolute inset-0 opacity-60 mix-blend-soft-light"
                      style={{ background: `radial-gradient(400px 200px at 15% 20%, ${accent.glow}, transparent 60%)` }}
                    />
                  )}

                  {/* SVG infographic corner when banner is present (mini) */}
                  {service.banner && (
                    <div className="pointer-events-none absolute top-3 right-3 w-16 h-12 md:w-20 md:h-14 opacity-85 group-hover:opacity-100 transition-opacity duration-500">
                      <Info className="w-full h-full" />
                    </div>
                  )}

                  {/* Tag chip */}
                  <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full backdrop-blur-md bg-black/40 border border-white/20 text-[9px] font-black uppercase tracking-[0.18em] text-white shadow-[0_2px_10px_rgba(0,0,0,0.35)]">
                    <Star size={9} className="fill-current text-[var(--color-luxury-gold)]" />
                    {service.tag}
                  </span>

                  {/* Title overlaid on hero */}
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-[17px] md:text-lg font-black tracking-tight text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.65)] group-hover:text-[var(--color-luxury-gold)] transition-colors duration-300">
                      {service.title}
                    </h3>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 relative z-10">
                  <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-3 min-h-[62px]">
                    {service.blurb}
                  </p>

                  {/* Stats row */}
                  <div className="mt-4 flex items-stretch gap-2">
                    {service.stats.map((s) => (
                      <div
                        key={s.label}
                        className="flex-1 rounded-xl border border-[color-mix(in_oklab,var(--color-luxury-gold)_14%,transparent)] bg-[color-mix(in_oklab,var(--color-muted)_40%,transparent)] px-2.5 py-2 text-center"
                      >
                        <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">{s.label}</div>
                        <div className="text-[15px] font-black text-foreground mt-0.5" style={{ color: accent.text }}>
                          {s.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Input → Output flow */}
                  <div className="mt-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/85">
                    <span className="truncate flex-1">{service.inputLabel}</span>
                    <Clock size={10} className="opacity-60 shrink-0" />
                    <span className="truncate flex-1 text-right">{service.outputLabel}</span>
                  </div>

                  {/* CTA */}
                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-400">
                      ₹0 · No card
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-luxury-gold)] group-hover:translate-x-1 transition-transform duration-300"
                      aria-hidden
                    >
                      Start free <ArrowRight size={12} />
                    </span>
                  </div>
                </div>

                {/* Hover glow border */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-[26px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    boxShadow: `inset 0 0 0 1px ${accent.ring}, 0 0 45px -12px ${accent.glow}`,
                  }}
                />
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
          Browse All 37+ Service Categories <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}
