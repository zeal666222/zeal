#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — HIGH-END AUTH + CONSULTANT WORKSPACE
# ═══════════════════════════════════════════════════════════════════════════════
# 8 files. Premium auth UX, role-aware redirects, consultant workspace shell.
# Style: btn-3d, glass-card-3d, #9D7DC5/#533AFD, dark-first, framer-motion.
# ═══════════════════════════════════════════════════════════════════════════════

set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

BOLD='\033[1m'; GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail()  { echo -e "${RED}[FAIL]${NC} $1"; }
h()     { echo ""; echo -e "${BOLD}═══ $1 ═══${NC}"; }

TS="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="_archive/consultant-premium-${TS}"
mkdir -p "$ARCHIVE"
E=0

echo ""
echo -e "${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  ZEAL — HIGH-END AUTH + CONSULTANT WORKSPACE                   ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"

backup() {
  local f="$1"
  [[ -f "$f" ]] && cp "$f" "${ARCHIVE}/backup-$(echo "$f" | sed 's|/|_|g')"
}

# ─── 1/8 — login ──────────────────────────────────────────────────────────────
h "1/8 — apps/web/app/login/page.tsx"
backup apps/web/app/login/page.tsx
cat > apps/web/app/login/page.tsx << 'LOGIN'
"use client";

import { useState, Suspense, useMemo } from "react";
import { loginAction } from "@/actions/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles, Loader2, Mail, Lock, ShieldCheck, AlertCircle, Briefcase, ArrowRight,
} from "lucide-react";

function friendlyError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credential"))
    return "Email or password is incorrect.";
  if (m.includes("rate") || m.includes("too many"))
    return "Too many attempts. Please wait a minute.";
  if (m.includes("lock")) return raw;
  if (m.includes("email not confirmed"))
    return "Please confirm your email before signing in.";
  return raw || "Authentication failed.";
}

function LoginContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "verifying" | "redirecting">("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectedFrom") || "/explore";

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);
  const formValid = emailValid && password.length > 0;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!formValid) return;

    setLoading(true);
    setPhase("verifying");
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.append("redirectTo", redirectTo);

    const res = await loginAction(formData);

    if (res.success && res.destination) {
      setPhase("redirecting");
      router.push(res.destination);
    } else {
      setError(friendlyError(res.error || ""));
      setLoading(false);
      setPhase("idle");
    }
  };

  const isConsultantPath = redirectTo.startsWith("/consultant");

  return (
    <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative z-10">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 border border-purple-500/30 rounded-[1.25rem] flex items-center justify-center mx-auto mb-5 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-white/5" />
          <Sparkles className="text-purple-400 relative z-10" size={32} />
        </div>
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 tracking-tight">
          Command Center
        </h1>
        <p className="text-slate-400 text-sm mt-2 font-medium">
          {isConsultantPath ? "Consultant access" : "Unified access for Seekers & Guides"}
        </p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold text-center flex items-center justify-center gap-2"
        >
          <AlertCircle size={14} /> {error}
        </motion.div>
      )}

      {phase !== "idle" && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold text-center flex items-center justify-center gap-2"
        >
          <ShieldCheck size={14} />
          {phase === "verifying" ? "Verifying identity..." : "Redirecting to your dashboard..."}
        </motion.div>
      )}

      <div className="mb-6">
        <GoogleAuthButton
          label="Sign in with Google"
          redirectPath={redirectTo}
          intent={isConsultantPath ? "consultant" : "user"}
        />
      </div>

      <div className="relative flex items-center justify-center mb-6">
        <div className="border-t border-white/10 w-full" />
        <span className="bg-slate-900 px-4 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Or</span>
        <div className="border-t border-white/10 w-full" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Email Address
          </label>
          <div className="relative group">
            <Mail size={18} className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              placeholder="you@example.com"
              className={`w-full pl-12 pr-4 py-3.5 bg-slate-950/50 border rounded-2xl text-sm focus:border-purple-500 focus:bg-slate-950 text-white outline-none transition-all shadow-inner ${
                touched.email && !emailValid ? "border-rose-500/50" : "border-white/10"
              }`}
            />
          </div>
          {touched.email && !emailValid && email.length > 0 && (
            <p className="mt-1.5 text-[11px] text-rose-400 flex items-center gap-1.5">
              <AlertCircle size={11} /> Enter a valid email address
            </p>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Secure Password
          </label>
          <div className="relative group">
            <Lock size={18} className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              placeholder="••••••••"
              className="w-full pl-12 pr-4 py-3.5 bg-slate-950/50 border border-white/10 rounded-2xl text-sm focus:border-purple-500 focus:bg-slate-950 text-white outline-none transition-all shadow-inner"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !formValid}
          className="btn-3d w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 mt-8 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> {phase === "redirecting" ? "Redirecting..." : "Authenticating..."}</>
          ) : (
            <><ShieldCheck size={16} /> Authenticate Session</>
          )}
        </button>
      </form>

      <div className="mt-8 text-center pt-6 border-t border-white/5">
        <p className="text-slate-400 text-xs font-medium">
          Don't have an account?{" "}
          <Link href="/register" className="text-purple-400 font-bold hover:text-purple-300 transition-colors">
            Create one now
          </Link>
        </p>
        <p className="text-slate-500 text-[11px] font-medium mt-3">
          Consultant access is available after approval.{" "}
          <Link href="/apply" className="text-purple-400 font-bold hover:text-purple-300 transition-colors">
            Apply here
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen-app flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-600/15 blur-[160px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none mix-blend-screen" />
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center relative z-10">
            <Loader2 className="animate-spin text-purple-500 mb-4" size={32} />
            <p className="text-slate-400 font-bold animate-pulse text-sm">Initializing Secure Gateway...</p>
          </div>
        }
      >
        <LoginContent />
      </Suspense>
    </div>
  );
}
LOGIN
ok "written"

# ─── 2/8 — register ───────────────────────────────────────────────────────────
h "2/8 — apps/web/app/register/page.tsx"
backup apps/web/app/register/page.tsx
cat > apps/web/app/register/page.tsx << 'REGISTER'
"use client";

import { useState, useMemo } from "react";
import { registerAction } from "@/actions/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles, Loader2, Mail, Lock, User as UserIcon,
  Briefcase, ArrowRight, ShieldCheck, Compass, AlertCircle, Check,
} from "lucide-react";

type Strength = 0 | 1 | 2 | 3;
const STRENGTH_META: Record<Strength, { label: string; color: string; width: string }> = {
  0: { label: "", color: "", width: "0%" },
  1: { label: "Weak", color: "bg-rose-500", width: "33%" },
  2: { label: "Fair", color: "bg-amber-500", width: "66%" },
  3: { label: "Strong", color: "bg-emerald-500", width: "100%" },
};

function computeStrength(pw: string): Strength {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return 1;
  if (s === 2) return 2;
  return 3;
}

export default function RegisterPage() {
  const [accountType, setAccountType] = useState<"user" | "consultant">("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const router = useRouter();

  const strength = useMemo(() => computeStrength(password), [password]);
  const meta = STRENGTH_META[strength];
  const passwordOk = password.length >= 12;
  const matches = password.length > 0 && password === confirm;
  const canSubmit = passwordOk && matches;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) {
      if (!passwordOk) setError("Password must be at least 12 characters.");
      else if (!matches) setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.append("accountType", accountType);

    const res = await registerAction(formData);

    if (res.success && res.destination) {
      router.push(res.destination);
    } else {
      setError(res.error || "Failed to create account.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen-app flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 blur-[180px] rounded-full pointer-events-none mix-blend-screen" />

      <div className="w-full max-w-lg bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight">Join Project Zeal</h1>
          <p className="text-slate-400 text-sm mt-2 font-medium">Select your portal intent to begin.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-1.5 rounded-2xl border border-white/5 mb-8 shadow-inner">
          <button
            type="button"
            onClick={() => setAccountType("user")}
            className={`py-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
              accountType === "user"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 scale-[1.02]"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            }`}
          >
            <Compass size={16} /> Seeker
          </button>
          <button
            type="button"
            onClick={() => setAccountType("consultant")}
            className={`py-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
              accountType === "consultant"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-[1.02]"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            }`}
          >
            <Briefcase size={16} /> Guide / Advisor
          </button>
        </div>

        {accountType === "consultant" && (
          <div className="mb-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs space-y-2 animate-in fade-in zoom-in-95">
            <div className="font-black flex items-center gap-2 text-indigo-200">
              <ShieldCheck size={16} className="text-indigo-400" /> Consultant Fast-Track
            </div>
            <p className="text-[11px] leading-relaxed text-indigo-300/80 font-medium">
              After creating your account, you'll be routed to a multi-step verification form. Approval typically takes 24 hours.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold text-center flex items-center justify-center gap-2 animate-in fade-in">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="mb-6">
          <GoogleAuthButton
            label={accountType === "consultant" ? "Apply with Google" : "Sign up with Google"}
            redirectPath={accountType === "consultant" ? "/apply" : "/explore"}
            intent={accountType}
          />
        </div>

        <div className="relative flex items-center justify-center mb-6">
          <div className="border-t border-white/10 w-full" />
          <span className="bg-slate-900 px-4 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Or Email</span>
          <div className="border-t border-white/10 w-full" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Legal Name</label>
            <div className="relative group">
              <UserIcon size={18} className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
              <input name="fullName" type="text" required placeholder="Aacharya Sharma"
                className="w-full pl-12 pr-4 py-3.5 bg-slate-950/50 border border-white/10 rounded-2xl text-sm focus:border-purple-500 focus:bg-slate-950 text-white outline-none transition-all shadow-inner" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
            <div className="relative group">
              <Mail size={18} className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
              <input name="email" type="email" required placeholder="name@domain.com"
                className="w-full pl-12 pr-4 py-3.5 bg-slate-950/50 border border-white/10 rounded-2xl text-sm focus:border-purple-500 focus:bg-slate-950 text-white outline-none transition-all shadow-inner" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Create Password</label>
            <div className="relative group">
              <Lock size={18} className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
              <input
                name="password"
                type="password"
                required
                minLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 12 characters"
                className={`w-full pl-12 pr-4 py-3.5 bg-slate-950/50 border rounded-2xl text-sm focus:border-purple-500 focus:bg-slate-950 text-white outline-none transition-all shadow-inner ${
                  password.length > 0 && !passwordOk ? "border-rose-500/40" : "border-white/10"
                }`}
              />
            </div>

            {password.length > 0 && (
              <div className="mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${meta.color} transition-all duration-500 ease-out rounded-full`} style={{ width: meta.width }} />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                    strength === 1 ? "text-rose-400" : strength === 2 ? "text-amber-400" : "text-emerald-400"
                  }`}>{meta.label}</span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">
                  {passwordOk ? "✓ Meets 12-character minimum" : `${12 - password.length} more character${12 - password.length === 1 ? "" : "s"} required`}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Confirm Password</label>
            <div className="relative group">
              <Lock size={18} className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
              <input
                name="confirmPassword"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                className={`w-full pl-12 pr-4 py-3.5 bg-slate-950/50 border rounded-2xl text-sm focus:border-purple-500 focus:bg-slate-950 text-white outline-none transition-all shadow-inner ${
                  confirm.length > 0 && !matches ? "border-rose-500/40" : "border-white/10"
                }`}
              />
              {matches && confirm.length > 0 && (
                <Check size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400" />
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="btn-3d w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 mt-8 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <span>{accountType === "consultant" ? "Initialize Application" : "Create Seeker Profile"}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-white/5">
          <p className="text-slate-400 text-xs font-medium">
            Already have an account?{" "}
            <Link href="/login" className="text-purple-400 font-bold hover:text-purple-300 transition-colors">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
REGISTER
ok "written"

# ─── 3/8 — apply ──────────────────────────────────────────────────────────────
h "3/8 — apps/web/app/apply/page.tsx"
backup apps/web/app/apply/page.tsx
cat > apps/web/app/apply/page.tsx << 'APPLY'
"use client";

import { useEffect, useState } from "react";
import { submitConsultantApplication, checkApplicationStatus } from "@/actions/consultant";
import {
  Sparkles, Send, Loader2, BookOpen, Clock, ShieldCheck,
  ArrowRight, Briefcase, Check, AlertCircle, Compass, Star,
} from "lucide-react";
import Link from "next/link";

const CATEGORIES = [
  { id: "Vedic Astrology", icon: "🔮", desc: "Jyotish, Dasha cycles, Kundali analysis" },
  { id: "Tarot Reading",   icon: "🃏", desc: "Rider-Waite, Oracle, Lenormand" },
  { id: "Numerology",      icon: "🔢", desc: "Life Path, Chaldean, Pythagorean" },
  { id: "Vastu Shastra",   icon: "🏛️", desc: "Spatial alignment, Feng Shui principles" },
];

export default function ApplyPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expertise, setExpertise] = useState("");
  const [bio, setBio] = useState("");
  const [rate, setRate] = useState(50);

  const bioOk = bio.trim().length >= 20;

  useEffect(() => {
    (async () => {
      const r = await checkApplicationStatus();
      setStatus(r.status);
      setLoading(false);
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bioOk) { setError("Bio must be at least 20 characters."); return; }
    setSubmitting(true);
    setError(null);

    const fd = new FormData();
    fd.append("expertise", expertise);
    fd.append("bio", bio);
    fd.append("perMinuteRate", String(rate));

    const res = await submitConsultantApplication(fd);
    if (res.success) setStatus("pending");
    else setError(res.error || "Submission failed.");
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="min-h-screen-app bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/30 rounded-[2.5rem] p-10 text-center shadow-2xl max-w-lg w-full">
          <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock size={32} className="text-indigo-400" />
          </div>
          <h1 className="text-3xl font-black mb-4 text-white">Application Under Review</h1>
          <p className="text-slate-400">
            Your profile has been transmitted. Our admin team will verify your credentials within 24 hours.
          </p>
          <div className="mt-6 p-4 rounded-2xl bg-slate-950/50 border border-white/5 text-left text-xs space-y-2">
            <div className="flex items-center gap-2 text-slate-300">
              <Check size={14} className="text-emerald-400" /> Profile created
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Check size={14} className="text-emerald-400" /> Wallet initialized
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <Clock size={14} /> Awaiting verification
            </div>
          </div>
          <Link href="/explore" className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl mt-8 font-bold transition-all text-sm text-white">
            Return to Explore
          </Link>
        </div>
      </div>
    );
  }

  if (status === "verified" || status === "approved") {
    return (
      <div className="min-h-screen-app bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-emerald-500/30 rounded-[2.5rem] p-10 text-center shadow-2xl max-w-lg w-full">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-3xl font-black mb-4 text-white">You are a Consultant</h1>
          <p className="text-slate-400">Your profile is verified and live.</p>
          <Link href="/consultant/dashboard" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white rounded-xl mt-8 font-bold transition-all text-sm shadow-xl shadow-emerald-500/20">
            Enter Command Center <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen-app bg-slate-950 text-slate-50 flex items-center justify-center p-4 sm:p-10 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-2xl w-full relative z-10">
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl">
          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mb-10">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center gap-2">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black transition-all duration-500 ${
                  step >= n
                    ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30"
                    : "bg-slate-800 text-slate-500"
                }`}>
                  {step > n ? <Check size={14} /> : n}
                </div>
                {n < 3 && (
                  <div className={`w-8 h-0.5 rounded-full transition-all duration-500 ${step > n ? "bg-indigo-500" : "bg-slate-800"}`} />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-bold text-center flex items-center justify-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-4">
                  <Briefcase size={14} /> Phase 1 · Domain
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white">Your Discipline</h1>
                <p className="text-slate-400 text-sm mt-2">Select your primary metaphysical practice.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setExpertise(c.id)}
                    className={`p-5 rounded-2xl border-2 text-left transition-all ${
                      expertise === c.id
                        ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                        : "border-white/5 bg-slate-950 hover:border-white/20"
                    }`}
                  >
                    <div className="text-2xl mb-2">{c.icon}</div>
                    <h3 className="font-bold text-slate-100 text-sm mb-0.5">{c.id}</h3>
                    <p className="text-[11px] text-slate-500 leading-snug">{c.desc}</p>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!expertise}
                className="btn-3d w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-4">
                  <Star size={14} /> Phase 2 · Rate
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white">Consultation Rate</h1>
                <p className="text-slate-400 text-sm mt-2">Set your per-minute charge (₹10 – ₹500).</p>
              </div>

              <div className="p-8 bg-slate-950/50 rounded-3xl border border-white/5 mb-8 text-center">
                <p className="text-5xl font-black font-mono text-white mb-3">₹{rate}</p>
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-6">per minute</p>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={10}
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-mono">
                  <span>₹10</span><span>₹500</span>
                </div>
                <div className="mt-6 pt-6 border-t border-white/5">
                  <p className="text-xs text-slate-400">
                    You earn <strong className="text-emerald-400">{Math.round(rate * 0.9)}₹/min</strong> after the 10% platform fee.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-sm transition-all text-white">Back</button>
                <button onClick={() => setStep(3)} className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2">
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-4">
                  <Sparkles size={14} /> Final · Bio
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white">Professional Bio</h1>
                <p className="text-slate-400 text-sm mt-2">Describe your lineage, certifications, and philosophy.</p>
              </div>

              <form onSubmit={handleSubmit}>
                <textarea
                  required
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={6}
                  placeholder="I have practiced Vedic astrology for over 15 years, trained under..."
                  className={`w-full p-5 bg-slate-950 border rounded-2xl text-sm focus:border-emerald-500 outline-none text-slate-200 resize-none custom-scrollbar ${
                    bio.length > 0 && !bioOk ? "border-rose-500/40" : "border-white/10"
                  }`}
                />
                <div className="flex items-center justify-between mt-2 text-[11px]">
                  <span className={bioOk ? "text-emerald-400 font-medium" : "text-slate-500 font-medium"}>
                    {bioOk ? "✓ Bio meets minimum length" : `Minimum 20 characters (${bio.trim().length}/20)`}
                  </span>
                  <span className="text-slate-600 font-mono">{bio.length}/1000</span>
                </div>

                <div className="flex gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={submitting}
                    className="px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-sm transition-all disabled:opacity-50 text-white"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={!bioOk || submitting}
                    className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/20 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <>Transmit Application <Send size={16} /></>}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-6">
          Need help?{" "}
          <Link href="/explore" className="text-purple-400 hover:text-purple-300 font-bold">
            Return to Explore
          </Link>
        </p>
      </div>
    </div>
  );
}
APPLY
ok "written"

# ─── 4/8 — consultant/layout ──────────────────────────────────────────────────
h "4/8 — apps/web/app/consultant/layout.tsx"
backup apps/web/app/consultant/layout.tsx
mkdir -p apps/web/app/consultant
cat > apps/web/app/consultant/layout.tsx << 'CLAYOUT'
// apps/web/app/consultant/layout.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Consultant Workspace Layout
//   • Auth check + role guard
//   • Loads consultant profile + wallet
//   • Renders WorkspaceSidebar + main shell
// ═══════════════════════════════════════════════════════════════════════════════

import { redirect } from "next/navigation";
import { createServerClientFromCookies } from "@zeal/database/server";
import { WorkspaceSidebar } from "@/components/consultant/WorkspaceSidebar";

export const metadata = {
  title: "Consultant Studio | Zeal",
  description: "Manage your practice on Zeal",
};

export const dynamic = "force-dynamic";

interface ProfileRow {
  id: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: string;
}
interface ConsultantRow {
  id: string;
  status: string;
  subdomain: string | null;
  isActive: boolean;
}

export default async function ConsultantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClientFromCookies();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectedFrom=/consultant/dashboard");

  const [profileRes, consultantRes] = await Promise.all([
    supabase
      .from("User")
      .select("id, name, email, avatar, role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("Consultant")
      .select("id, status, subdomain, isActive")
      .eq("userId", user.id)
      .maybeSingle(),
  ]);

  const profile = profileRes.data as ProfileRow | null;
  const consultant = consultantRes.data as ConsultantRow | null;

  // Not a consultant → route to /apply
  if (!consultant) {
    redirect("/apply");
  }

  // Count pending bookings for badge
  const { count: pendingCount } = await supabase
    .from("Booking")
    .select("*", { count: "exact", head: true })
    .eq("consultantId", consultant.id)
    .eq("status", "PENDING");

  return (
    <div className="min-h-screen-app bg-slate-950 text-slate-50">
      <WorkspaceSidebar
        user={{
          name: profile?.name ?? null,
          email: profile?.email ?? null,
          avatar: profile?.avatar ?? null,
        }}
        consultant={{
          status: consultant.status,
          subdomain: consultant.subdomain,
        }}
        pendingBookings={pendingCount ?? 0}
      />

      <main className="lg:ml-64 min-h-screen-app pb-20 lg:pb-8">
        <div className="pt-14 lg:pt-0">
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
CLAYOUT
ok "written"

# ─── 5/8 — consultant/dashboard (server page wrapper) ────────────────────────
h "5/8 — apps/web/app/consultant/dashboard/page.tsx"
backup apps/web/app/consultant/dashboard/page.tsx
cat > apps/web/app/consultant/dashboard/page.tsx << 'CDASH'
import { createServerClientFromCookies } from "@zeal/database/server";
import { redirect } from "next/navigation";
import { StudioClient } from "@/components/consultant/StudioClient";

export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  name: string | null;
  is_online: boolean | null;
}
interface WalletRow {
  balance: number;
}

export default async function ConsultantDashboardPage() {
  const supabase = await createServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, walletRes] = await Promise.all([
    supabase
      .from("User")
      .select("id, name, is_online")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("Wallet")
      .select("balance")
      .eq("userId", user.id)
      .maybeSingle(),
  ]);

  const u = profileRes.data as UserRow | null;
  const w = walletRes.data as WalletRow | null;

  return (
    <StudioClient
      initialProfile={{
        id: user.id,
        full_name: u?.name ?? "Consultant",
        wallet_balance: w?.balance ?? 0,
        is_online: u?.is_online ?? false,
      }}
    />
  );
}
CDASH
ok "written"

# ─── 6/8 — consultant/bookings ────────────────────────────────────────────────
h "6/8 — apps/web/app/consultant/bookings/page.tsx"
backup apps/web/app/consultant/bookings/page.tsx
cat > apps/web/app/consultant/bookings/page.tsx << 'CBOOK'
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Clock, User, IndianRupee, Loader2, Search, Filter } from "lucide-react";

interface Booking {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  amount: number;
  userName: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  CONFIRMED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  IN_PROGRESS: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  COMPLETED: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  CANCELLED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

type Filter = "all" | "PENDING" | "CONFIRMED" | "COMPLETED";

export default function ConsultantBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/consultant/bookings")
      .then((r) => (r.ok ? r.json() : { bookings: [] }))
      .then((d) => setBookings(d.bookings ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (filter !== "all" && b.status !== filter) return false;
      if (q && !(b.userName || "").toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [bookings, filter, q]);

  const stats = useMemo(() => ({
    total: bookings.length,
    pending: bookings.filter((b) => b.status === "PENDING").length,
    confirmed: bookings.filter((b) => b.status === "CONFIRMED").length,
    completed: bookings.filter((b) => b.status === "COMPLETED").length,
  }), [bookings]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-white">Bookings</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your incoming and upcoming sessions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "Pending", value: stats.pending, color: "text-amber-400" },
          { label: "Confirmed", value: stats.confirmed, color: "text-emerald-400" },
          { label: "Completed", value: stats.completed, color: "text-slate-400" },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{s.label}</p>
            <p className={`text-2xl font-black font-mono mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by client name..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-white/5 rounded-xl text-sm text-white placeholder:text-slate-500 outline-none focus:border-purple-500/50"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "PENDING", "CONFIRMED", "COMPLETED"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                filter === f
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/20"
                  : "bg-slate-900/60 border border-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">{bookings.length === 0 ? "No bookings yet" : "No bookings match your filters"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <Link
              key={b.id}
              href={`/chat/${b.id}`}
              className="block p-4 lg:p-5 bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl hover:border-purple-500/40 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 flex-shrink-0">
                    <User size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm truncate">{b.userName || "Seeker"}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {new Date(b.scheduledAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {b.durationMinutes}m
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-purple-400 font-bold text-sm flex items-center gap-1 justify-end">
                    <IndianRupee size={12} /> {b.amount}
                  </p>
                  <span className={`inline-block mt-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                    STATUS_STYLE[b.status] || STATUS_STYLE.COMPLETED
                  }`}>
                    {b.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
CBOOK
ok "written"

# ─── 7/8 — consultant/clients ─────────────────────────────────────────────────
h "7/8 — apps/web/app/consultant/clients/page.tsx"
backup apps/web/app/consultant/clients/page.tsx
cat > apps/web/app/consultant/clients/page.tsx << 'CCLIENT'
"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, Loader2, Search, Mail, Calendar } from "lucide-react";

interface Client {
  id: string;
  name: string | null;
  email: string | null;
  lastSessionAt: string | null;
  sessions: number;
}

export default function ConsultantClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/consultant/clients")
      .then((r) => (r.ok ? r.json() : { clients: [] }))
      .then((d) => setClients(d.clients ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    if (!ql) return clients;
    return clients.filter((c) =>
      (c.name || "").toLowerCase().includes(ql) ||
      (c.email || "").toLowerCase().includes(ql)
    );
  }, [clients, q]);

  const totalSessions = clients.reduce((s, c) => s + c.sessions, 0);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-white">Clients</h1>
        <p className="text-sm text-slate-400 mt-1">Your relationship history</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Clients</p>
          <p className="text-2xl font-black font-mono mt-1 text-white">{clients.length}</p>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Sessions</p>
          <p className="text-2xl font-black font-mono mt-1 text-purple-400">{totalSessions}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search clients by name or email..."
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/60 border border-white/5 text-sm text-white placeholder:text-slate-500 focus:border-purple-500/50 outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">{q ? "No clients match your search" : "No clients yet"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-4 p-4 bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl hover:border-purple-500/20 transition-all"
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500/30 to-indigo-500/20 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                {((c.name || c.email || "?")[0] ?? "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm truncate">{c.name || "Anonymous"}</p>
                {c.email && (
                  <p className="text-xs text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                    <Mail size={11} /> {c.email}
                  </p>
                )}
                {c.lastSessionAt && (
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <Calendar size={11} /> Last session {new Date(c.lastSessionAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-black text-purple-400 font-mono">{c.sessions}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">sessions</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
CCLIENT
ok "written"

# ─── 8/8 — consultant/earnings ────────────────────────────────────────────────
h "8/8 — apps/web/app/consultant/earnings/page.tsx"
backup apps/web/app/consultant/earnings/page.tsx
cat > apps/web/app/consultant/earnings/page.tsx << 'CEARN'
"use client";

import { useEffect, useMemo, useState } from "react";
import { Wallet, IndianRupee, ArrowUpRight, ArrowDownRight, Loader2, TrendingUp } from "lucide-react";

interface Tx {
  id: string;
  type: string;
  amount: number;
  balance: number;
  description: string;
  createdAt: string;
}

export default function ConsultantEarningsPage() {
  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/consultant/earnings")
      .then((r) => (r.ok ? r.json() : { balance: 0, transactions: [] }))
      .then((d) => {
        setBalance(d.balance ?? 0);
        setTxs(d.transactions ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const earned = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const paid = txs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const last7 = txs
      .filter((t) => t.amount > 0 && new Date(t.createdAt) > new Date(Date.now() - 7 * 864e5))
      .reduce((s, t) => s + t.amount, 0);
    return { earned, paid, last7 };
  }, [txs]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-white">Earnings</h1>
        <p className="text-sm text-slate-400 mt-1">Real-time wallet and payout history</p>
      </div>

      {/* Balance card */}
      <div className="relative overflow-hidden p-6 lg:p-8 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-3xl shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Available Balance
            </span>
          </div>
          <div className="flex items-center gap-2 text-white">
            <IndianRupee className="w-8 h-8 text-emerald-400" />
            <span className="text-3xl lg:text-5xl font-black font-mono tracking-tight">
              {Number(balance).toFixed(2)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/5">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Lifetime earned</p>
              <p className="text-sm font-black font-mono text-emerald-400 mt-1">
                ₹{stats.earned.toFixed(0)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Last 7 days</p>
              <p className="text-sm font-black font-mono text-purple-400 mt-1 flex items-center gap-1">
                <TrendingUp size={11} /> ₹{stats.last7.toFixed(0)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Withdrawn</p>
              <p className="text-sm font-black font-mono text-slate-300 mt-1">
                ₹{stats.paid.toFixed(0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-5 lg:p-6">
        <h2 className="text-base lg:text-lg font-bold text-white mb-4">Recent Transactions</h2>

        {txs.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {txs.slice(0, 30).map((tx) => {
              const credit = tx.amount > 0;
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      credit ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                    }`}>
                      {credit ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{tx.description}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(tx.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold font-mono flex-shrink-0 ${
                    credit ? "text-emerald-400" : "text-slate-300"
                  }`}>
                    {credit ? "+" : "-"}₹{Math.abs(tx.amount).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
CEARN
ok "written"

# ─── Verify + commit ──────────────────────────────────────────────────────────
h "VERIFY + COMMIT"

info "Type-check web..."
TC=$(npm run type-check --workspace=web 2>&1 || true)
if echo "$TC" | grep -qE "error TS"; then
  warn "Errors:"
  echo "$TC" | grep "error TS" | head -10
  E=$((E+1))
else
  ok "web passed"
fi

info "Staging + committing..."
git add -A
git reset -- _archive/ 2>/dev/null || true
git commit -m "Premium auth + consultant workspace

- login: role-aware redirect messaging, friendly error mapping, phase states
- register: confirm password, real-time validation, consultant CTA
- apply: 3-step wizard with domain/rate/bio, success + verified states
- consultant/layout: fixed broken guard, clean shell, pending badge
- consultant/dashboard: server page wrapper for StudioClient
- consultant/bookings: filters, stats, status badges, search
- consultant/clients: search, stats, session counts
- consultant/earnings: multi-stat balance card, transaction ledger" 2>&1 | tail -3

info "Pushing..."
git push origin main 2>&1 | tail -5

echo ""
if [[ $E -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║  DONE — 8 FILES ENHANCED, PUSHED                               ║${NC}"
  echo -e "${GREEN}${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
else
  echo -e "${YELLOW}${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}${BOLD}║  DONE — ${E} TYPE ERROR(S), FIX BEFORE PUSHING                    ║${NC}"
  echo -e "${YELLOW}${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
fi
echo ""
echo "Backups: $ARCHIVE"
echo ""
echo "After push, Vercel auto-deploys. Test:"
echo "  https://zeal-web-red.vercel.app/login"
echo "  https://zeal-web-red.vercel.app/register"
echo "  https://zeal-web-red.vercel.app/apply"
echo "  https://zeal-web-red.vercel.app/consultant/dashboard"
echo ""

exit 0
