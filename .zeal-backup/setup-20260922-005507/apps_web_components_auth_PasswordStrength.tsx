"use client";

import { motion } from "framer-motion";

export type Strength = 0 | 1 | 2 | 3 | 4;

const META: Record<Strength, { label: string; color: string; width: string }> = {
  0: { label: "",       color: "",               width: "0%" },
  1: { label: "Weak",   color: "bg-rose-500",    width: "25%" },
  2: { label: "Fair",   color: "bg-amber-500",   width: "50%" },
  3: { label: "Good",   color: "bg-blue-500",    width: "75%" },
  4: { label: "Strong", color: "bg-emerald-500", width: "100%" },
};

export function scorePassword(pw: string): Strength {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 12) s++;
  if (pw.length >= 16) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4) as Strength;
}

export function PasswordStrength({ value }: { value: string }) {
  const strength = scorePassword(value);
  const meta = META[strength];
  const remaining = Math.max(0, 12 - value.length);

  if (!value) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            animate={{ width: meta.width }}
            transition={{ duration: 0.4 }}
            className={`h-full ${meta.color} rounded-full`}
          />
        </div>
        <span
          className={[
            "text-[10px] font-black uppercase tracking-widest",
            strength <= 1
              ? "text-rose-400"
              : strength === 2
                ? "text-amber-400"
                : strength === 3
                  ? "text-blue-400"
                  : "text-emerald-400",
          ].join(" ")}
        >
          {meta.label}
        </span>
      </div>
      <p className="text-[10px] text-slate-500">
        {remaining === 0
          ? "✓ 12-character minimum met"
          : `${remaining} more character${remaining === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}
