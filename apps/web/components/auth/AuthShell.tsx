"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Sparkles, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface AuthShellProps {
  mode: "login" | "register" | "recovery" | "mfa";
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  cta?: ReactNode;
  brandIcon?: LucideIcon;
  brandTitle?: string;
  features?: string[];
}

const COPY: Record<AuthShellProps["mode"], { headline: [string, string]; tagline: string }> = {
  login: {
    headline: ["Your practice,", "always on."],
    tagline:
      "Sessions, earnings, and seekers — everything in one calm, realtime console.",
  },
  register: {
    headline: ["Begin your", "journey."],
    tagline:
      "Instant activation. No approval queue. Complete your profile to go live.",
  },
  recovery: {
    headline: ["Recover", "your access."],
    tagline: "We'll help you get back in without a hitch.",
  },
  mfa: {
    headline: ["One more", "step."],
    tagline: "Confirm it's really you.",
  },
};

export function AuthShell({
  mode,
  title,
  subtitle,
  children,
  footer,
  cta,
  brandIcon: BrandIcon = Sparkles,
  brandTitle = "ZEAL",
  features,
}: AuthShellProps) {
  const copy = COPY[mode];

  return (
    <div className="min-h-screen bg-[#0B0A14] flex relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-indigo-500/10 blur-[160px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-purple-500/[0.08] blur-[160px] pointer-events-none" />

      <aside className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-14 border-r border-white/[0.06]">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-purple-500/20">
            <BrandIcon size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-black tracking-wider text-lg leading-none">
              {brandTitle}
            </p>
            <p className="text-[10px] text-slate-500 tracking-[0.2em] font-bold uppercase mt-0.5">
              Zeal Platform
            </p>
          </div>
        </Link>

        <div className="max-w-lg">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight"
          >
            {copy.headline[0]}
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
              {copy.headline[1]}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-slate-400 text-base mt-6 max-w-md"
          >
            {copy.tagline}
          </motion.p>

          {features && features.length > 0 && (
            <ul className="mt-10 space-y-3.5">
              {features.map((f, i) => (
                <motion.li
                  key={f}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.35 + i * 0.08 }}
                  className="flex items-center gap-3 text-sm text-slate-300"
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-emerald-400" />
                  </div>
                  {f}
                </motion.li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-6 text-[11px] text-slate-600">
          <span>© {new Date().getFullYear()} Zeal</span>
          <span>•</span>
          <span>SOC 2</span>
          <span>•</span>
          <span>GDPR</span>
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center p-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center">
                <BrandIcon size={18} className="text-white" />
              </div>
              <span className="text-white font-black tracking-wider text-lg">
                {brandTitle}
              </span>
            </Link>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">
              {title}
            </h2>
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          </div>

          {children}

          {footer && <div className="mt-6">{footer}</div>}
          {cta && <div className="mt-8">{cta}</div>}
        </motion.div>
      </main>
    </div>
  );
}
