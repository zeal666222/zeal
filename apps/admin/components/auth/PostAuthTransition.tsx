"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// PostAuthTransition — branded, role-aware transition after successful auth
// ─────────────────────────────────────────────────────────────────────────────
// Shown briefly (800ms–1.2s) between successful sign-in and the destination.
// Prevents the jarring instant redirect and gives the user a confident
// "we're setting things up" signal.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from "framer-motion";
import { AnimatedZealMark } from "@zeal/ui";
import { Check, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

type Destination = "studio" | "console" | "handoff";

interface Props {
  destination: Destination;
  email?: string | null;
}

const COPY: Record<Destination, { title: string; subtitle: string; steps: string[] }> = {
  studio: {
    title: "Opening your Studio",
    subtitle: "Preparing your workspace",
    steps: ["Authenticated", "Loading profile", "Syncing sessions"],
  },
  console: {
    title: "Opening the Console",
    subtitle: "Loading platform pulse",
    steps: ["Authenticated", "Verifying role", "Fetching metrics"],
  },
  handoff: {
    title: "Transferring session",
    subtitle: "Moving to the admin portal",
    steps: ["Authenticated", "Generating handoff", "Securing connection"],
  },
};

export function PostAuthTransition({ destination, email }: Props) {
  const copy = COPY[destination];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t1 = window.setTimeout(() => setStep(1), 220);
    const t2 = window.setTimeout(() => setStep(2), 480);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center overflow-hidden">
      {/* Ambient backdrop */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-purple-600/10 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-600/8 blur-[160px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md px-6"
      >
        {/* Animated mark */}
        <div className="flex justify-center mb-8">
          <motion.div
            initial={{ scale: 0.85, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
          >
            <AnimatedZealMark size={64} glow />
          </motion.div>
        </div>

        {/* Copy */}
        <div className="text-center mb-8">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-2xl font-black tracking-tight text-white"
          >
            {copy.title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="text-sm text-slate-500 mt-2"
          >
            {copy.subtitle}
          </motion.p>
          {email && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-xs text-slate-600 mt-1 font-mono"
            >
              {email}
            </motion.p>
          )}
        </div>

        {/* Step checklist */}
        <div className="space-y-2.5 max-w-xs mx-auto">
          {copy.steps.map((label, idx) => {
            const active = step === idx;
            const done = step > idx;
            return (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + idx * 0.08 }}
                className="flex items-center gap-3"
              >
                <div
                  className={
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 " +
                    (done
                      ? "bg-emerald-500/20 border border-emerald-500/40"
                      : active
                      ? "bg-purple-500/20 border border-purple-500/40"
                      : "bg-white/5 border border-white/10")
                  }
                >
                  {done ? (
                    <Check size={11} className="text-emerald-400" />
                  ) : active ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-3 h-3 rounded-full border-2 border-purple-400 border-t-transparent"
                    />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                  )}
                </div>
                <span
                  className={
                    "text-sm transition-colors duration-300 " +
                    (done
                      ? "text-slate-400 line-through"
                      : active
                      ? "text-white font-medium"
                      : "text-slate-600")
                  }
                >
                  {label}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 max-w-xs mx-auto"
        >
          <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
            />
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-3 text-[10px] font-black uppercase tracking-widest text-slate-600">
            <ArrowRight size={9} /> Secure session
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
