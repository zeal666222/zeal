#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — CONSULTANT AUTH FLOW
# ═══════════════════════════════════════════════════════════════════════════════
# 4 files:
#   REWRITE  apps/web/app/login/page.tsx             (seeker focus + consultant CTA)
#   REWRITE  apps/web/app/register/page.tsx          (seeker focus + fix Suspense)
#   NEW      apps/web/app/consultant/login/page.tsx  (dedicated consultant sign-in)
#   NEW      apps/web/app/consultant/register/page.tsx (dedicated consultant sign-up)
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
ARCHIVE="_archive/consultant-auth-${TS}"
mkdir -p "$ARCHIVE"
E=0

backup() {
  local f="$1"
  [[ -f "$f" ]] && cp "$f" "${ARCHIVE}/backup-$(echo "$f" | sed 's|/|_|g')"
}

echo ""
echo -e "${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  ZEAL — CONSULTANT AUTH FLOW                                   ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"

# ═══════════════════════════════════════════════════════════════════════════════
# 1/4 — apps/web/app/login/page.tsx (Seeker focus, prominent consultant CTA)
# ═══════════════════════════════════════════════════════════════════════════════
h "1/4 — apps/web/app/login/page.tsx (seeker-focused + consultant CTA)"
backup apps/web/app/login/page.tsx
cat > apps/web/app/login/page.tsx << 'SEEKER_LOGIN'
"use client";

import { useState, Suspense, useMemo } from "react";
import { loginAction } from "@/actions/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Loader2, Mail, Lock, ShieldCheck, AlertCircle,
  ArrowRight, Eye, EyeOff, Check, Flame, Compass, Briefcase,
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
  const [phase, setPhase] = useState<"idle" | "verifying" | "granted">("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirectedFrom") || "";

  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email]
  );
  const formValid = emailValid && password.length > 0;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!formValid) return;

    setLoading(true);
    setPhase("verifying");
    setError("");

    const fd = new FormData(e.currentTarget);
    if (redirectTo) fd.append("redirectTo", redirectTo);

    const res = await loginAction(fd);

    if (res.success && res.destination) {
      // If consultant tries to sign in here, gently route them
      if (res.destination === "/consultant/dashboard") {
        router.push(res.destination);
        return;
      }
      setPhase("granted");
      router.push(res.destination);
    } else {
      setError(friendlyError(res.error || ""));
      setPhase("idle");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-purple-600/10 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-600/8 blur-[160px] rounded-full pointer-events-none" />

      {/* ─── Left panel ─────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-14 border-r border-white/5">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-purple-500/30 group-hover:scale-105 transition-transform">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white font-black tracking-wider text-lg leading-none">ZEAL</p>
              <p className="text-[10px] text-slate-500 tracking-[0.2em] font-bold uppercase mt-0.5">
                Wellness Universe
              </p>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.7 }}
          className="max-w-lg"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-6">
            <Compass size={12} /> Seeker Access
          </div>
          <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight">
            Find your
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
              clarity.
            </span>
          </h1>
          <p className="text-slate-400 text-base mt-6 leading-relaxed max-w-md">
            Connect with verified consultants across 37+ traditions.
            Sign in to continue your journey.
          </p>

          <div className="mt-10 space-y-3.5">
            {[
              "Instant AI intent matching",
              "Verified & rated consultants",
              "Encrypted sessions",
              "Per-minute billing, no subscriptions",
            ].map((f, i) => (
              <motion.div
                key={f}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="flex items-center gap-3 text-sm text-slate-300"
              >
                <div className="w-5 h-5 rounded-full bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shrink-0">
                  <Check size={11} className="text-purple-400" />
                </div>
                {f}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Consultant path banner on left panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="max-w-md"
        >
          <Link
            href="/consultant/login"
            className="group flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-indigo-950/60 to-purple-950/40 border border-indigo-500/20 hover:border-indigo-500/50 transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform shrink-0">
              <Briefcase size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-sm">Are you a consultant?</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Sign in to your Command Center
              </p>
            </div>
            <ArrowRight size={16} className="text-indigo-400 group-hover:translate-x-1 transition-transform shrink-0" />
          </Link>
        </motion.div>
      </div>

      {/* ─── Right form panel ───────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-6">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center">
                <Sparkles size={18} className="text-white" />
              </div>
              <span className="text-white font-black text-lg tracking-wider">ZEAL</span>
            </Link>
          </div>

          {/* Mobile consultant CTA */}
          <Link
            href="/consultant/login"
            className="lg:hidden flex items-center gap-3 p-4 rounded-2xl bg-indigo-950/60 border border-indigo-500/20 mb-6 active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
              <Briefcase size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-xs">Consultant?</p>
              <p className="text-[10px] text-slate-400">Sign in to Command Center</p>
            </div>
            <ArrowRight size={14} className="text-indigo-400 shrink-0" />
          </Link>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Sign in to continue as a seeker
            </p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-start gap-2.5"
              >
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
            {phase !== "idle" && (
              <motion.div
                key="phase"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2.5"
              >
                <ShieldCheck size={14} />
                {phase === "verifying" ? "Verifying..." : "Access granted — routing..."}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mb-6">
            <GoogleAuthButton
              label="Continue with Google"
              redirectPath={redirectTo || "/explore"}
              intent="user"
            />
          </div>

          <div className="relative flex items-center justify-center mb-6">
            <div className="border-t border-white/5 w-full" />
            <span className="bg-slate-950 px-4 text-[10px] uppercase tracking-[0.25em] text-slate-600 font-bold">
              or
            </span>
            <div className="border-t border-white/5 w-full" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Email
              </label>
              <div className="relative group">
                <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors" />
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="you@example.com"
                  className={`w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-purple-500 ${
                    touched.email && !emailValid && email.length > 0
                      ? "border-rose-500/50"
                      : "border-white/5"
                  }`}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Password
                </label>
                <Link href="/forgot-password" className="text-[10px] text-purple-400 hover:text-purple-300 font-bold uppercase tracking-wider">
                  Forgot?
                </Link>
              </div>
              <div className="relative group">
                <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors" />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  placeholder="••••••••••••"
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-slate-300 transition-colors rounded-lg hover:bg-white/5"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !formValid}
              className="btn-3d w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {phase === "verifying" ? "Signing in..." : "Redirecting..."}
                </>
              ) : (
                <>
                  Sign in as Seeker <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <div className="mt-7 pt-6 border-t border-white/5 text-center space-y-2.5">
            <p className="text-xs text-slate-500">
              New to Zeal?{" "}
              <Link href="/register" className="text-purple-400 hover:text-purple-300 font-bold">
                Create a free account
              </Link>
            </p>
            <p className="text-[11px] text-slate-600">
              Administrator?{" "}
              <a
                href="https://zeal-admin-rose.vercel.app/login"
                className="text-rose-400 hover:text-rose-300 font-bold"
              >
                Restricted access
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="animate-spin text-purple-500" size={32} />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
SEEKER_LOGIN
ok "written"

# ═══════════════════════════════════════════════════════════════════════════════
# 2/4 — apps/web/app/register/page.tsx (Fix Suspense + seeker focus)
# ═══════════════════════════════════════════════════════════════════════════════
h "2/4 — apps/web/app/register/page.tsx (seeker-focused, Suspense fixed)"
backup apps/web/app/register/page.tsx
cat > apps/web/app/register/page.tsx << 'SEEKER_REGISTER'
"use client";

import { useState, useMemo, Suspense } from "react";
import { registerAction } from "@/actions/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Loader2, Mail, Lock, User as UserIcon,
  ArrowRight, ShieldCheck, Compass, AlertCircle, Check, Eye, EyeOff, Flame,
} from "lucide-react";

type Strength = 0 | 1 | 2 | 3 | 4;
const META: Record<Strength, { label: string; color: string; width: string }> = {
  0: { label: "", color: "", width: "0%" },
  1: { label: "Weak", color: "bg-rose-500", width: "20%" },
  2: { label: "Fair", color: "bg-amber-500", width: "45%" },
  3: { label: "Good", color: "bg-blue-500", width: "70%" },
  4: { label: "Strong", color: "bg-emerald-500", width: "100%" },
};

function strength(pw: string): Strength {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 12) s++;
  if (pw.length >= 16) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4) as Strength;
}

function RegisterContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const s = useMemo(() => strength(password), [password]);
  const meta = META[s];
  const passwordOk = password.length >= 12;
  const matches = password === confirm && confirm.length > 0;
  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);
  const nameValid = fullName.trim().length >= 2;
  const canSubmit = nameValid && emailValid && passwordOk && matches && agreed && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");

    const fd = new FormData();
    fd.append("fullName", fullName.trim());
    fd.append("email", email.trim().toLowerCase());
    fd.append("password", password);
    fd.append("accountType", "user");

    const res = await registerAction(fd);

    if (res.success && res.destination) {
      router.push(res.destination);
    } else {
      setError(res.error || "Registration failed.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex relative overflow-hidden">
      <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-purple-600/10 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/8 blur-[160px] rounded-full pointer-events-none" />

      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-14 border-r border-white/5">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-purple-500/30 group-hover:scale-105 transition-transform">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white font-black tracking-wider text-lg leading-none">ZEAL</p>
              <p className="text-[10px] text-slate-500 tracking-[0.2em] font-bold uppercase mt-0.5">
                Wellness Universe
              </p>
            </div>
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.7 }} className="max-w-lg">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-6">
            <Flame size={12} /> Free to join
          </div>
          <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight">
            Begin your
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
              journey.
            </span>
          </h1>
          <p className="text-slate-400 text-base mt-6 leading-relaxed max-w-md">
            Join thousands of seekers connecting with verified consultants across 37+ wellness traditions.
          </p>

          <div className="mt-10 space-y-3.5">
            {[
              "No subscription — pay only per session",
              "Verified consultants with ratings",
              "End-to-end encrypted conversations",
              "24/7 AI concierge support",
            ].map((f, i) => (
              <motion.div
                key={f}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="flex items-center gap-3 text-sm text-slate-300"
              >
                <div className="w-5 h-5 rounded-full bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shrink-0">
                  <Check size={11} className="text-purple-400" />
                </div>
                {f}
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="flex items-center gap-6 text-[11px] text-slate-600">
          <span>© 2026 Zeal</span>
          <span>•</span>
          <span>SOC 2 Type II</span>
          <span>•</span>
          <span>GDPR Compliant</span>
        </motion.div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden text-center mb-6">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center">
                <Sparkles size={18} className="text-white" />
              </div>
              <span className="text-white font-black text-lg tracking-wider">ZEAL</span>
            </Link>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">
              Create your account
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Join as a seeker — free forever
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-start gap-2.5"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <div className="mb-6">
            <GoogleAuthButton
              label="Sign up with Google"
              redirectPath="/explore"
              intent="user"
            />
          </div>

          <div className="relative flex items-center justify-center mb-6">
            <div className="border-t border-white/5 w-full" />
            <span className="bg-slate-950 px-4 text-[10px] uppercase tracking-[0.25em] text-slate-600 font-bold">
              or email
            </span>
            <div className="border-t border-white/5 w-full" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Full Name
              </label>
              <div className="relative group">
                <UserIcon size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Email
              </label>
              <div className="relative group">
                <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Password
              </label>
              <div className="relative group">
                <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 12 characters"
                  autoComplete="new-password"
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-slate-300 transition-colors rounded-lg hover:bg-white/5"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {password.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        animate={{ width: meta.width }}
                        transition={{ duration: 0.4 }}
                        className={`h-full ${meta.color} rounded-full`}
                      />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      s <= 1 ? "text-rose-400" :
                      s === 2 ? "text-amber-400" :
                      s === 3 ? "text-blue-400" : "text-emerald-400"
                    }`}>{meta.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {passwordOk
                      ? "✓ Meets 12-character minimum"
                      : `${12 - password.length} more character${12 - password.length === 1 ? "" : "s"} required`}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Confirm Password
              </label>
              <div className="relative group">
                <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors" />
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  className={`w-full pl-12 pr-12 py-3.5 bg-slate-900/60 border rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-purple-500 ${
                    confirm.length > 0 && !matches ? "border-rose-500/40" : "border-white/5"
                  }`}
                />
                {matches && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <Check size={12} className="text-emerald-400" />
                  </div>
                )}
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer py-2">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-5 h-5 rounded-md border-2 border-white/10 bg-slate-900/60 peer-checked:bg-purple-600 peer-checked:border-purple-600 transition-all flex items-center justify-center">
                  {agreed && <Check size={12} className="text-white" />}
                </div>
              </div>
              <span className="text-[11px] text-slate-500 leading-relaxed">
                I agree to Zeal's{" "}
                <Link href="/terms" className="text-purple-400 hover:text-purple-300 font-bold">Terms</Link>
                {" "}and{" "}
                <Link href="/privacy" className="text-purple-400 hover:text-purple-300 font-bold">Privacy Policy</Link>.
              </span>
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-3d w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Creating account...</>
              ) : (
                <>Create Seeker Account <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <div className="mt-7 pt-6 border-t border-white/5 text-center space-y-3">
            <p className="text-xs text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="text-purple-400 hover:text-purple-300 font-bold">
                Sign in
              </Link>
            </p>
            <Link
              href="/consultant/register"
              className="inline-flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 font-bold"
            >
              Register as a Consultant →
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="animate-spin text-purple-500" size={32} />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
SEEKER_REGISTER
ok "written"

# ═══════════════════════════════════════════════════════════════════════════════
# 3/4 — apps/web/app/consultant/login/page.tsx (NEW)
# ═══════════════════════════════════════════════════════════════════════════════
h "3/4 — apps/web/app/consultant/login/page.tsx (NEW)"
mkdir -p apps/web/app/consultant/login
cat > apps/web/app/consultant/login/page.tsx << 'CONSULTANT_LOGIN'
"use client";

import { useState, Suspense, useMemo } from "react";
import { loginAction } from "@/actions/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, Loader2, Mail, Lock, ShieldCheck, AlertCircle,
  ArrowRight, Eye, EyeOff, Check, IndianRupee, Users, Zap,
  BarChart3, Star, Activity, MessageSquare, Video,
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

function ConsultantLoginContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "verifying" | "granted">("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirectedFrom") || "/consultant/dashboard";

  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email]
  );
  const formValid = emailValid && password.length > 0;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!formValid) return;

    setLoading(true);
    setPhase("verifying");
    setError("");

    const fd = new FormData(e.currentTarget);
    fd.append("redirectTo", redirectTo);

    const res = await loginAction(fd);

    if (res.success && res.destination) {
      // Role check: only CLIENT_ADMIN / ADMIN should end up in command center
      const dest = res.destination;
      const isConsultant = dest === "/consultant/dashboard" || dest === "/admin";

      if (isConsultant) {
        setPhase("granted");
        router.push(dest);
      } else {
        // Plain USER tried to use consultant login
        setError(
          "This account isn't registered as a consultant. Apply now or switch to seeker sign-in."
        );
        setPhase("idle");
        setLoading(false);
      }
    } else {
      setError(friendlyError(res.error || ""));
      setPhase("idle");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex relative overflow-hidden">
      <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-indigo-600/10 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-600/6 blur-[160px] rounded-full pointer-events-none" />

      {/* ─── Left panel ─────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-14 border-r border-white/5">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 group-hover:scale-105 transition-transform">
              <Briefcase size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white font-black tracking-wider text-lg leading-none">ZEAL</p>
              <p className="text-[10px] text-slate-500 tracking-[0.2em] font-bold uppercase mt-0.5">
                Practice Console
              </p>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.7 }}
          className="max-w-lg"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-6">
            <Zap size={12} /> Consultant Sign In
          </div>
          <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight">
            Your practice,
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-500 bg-clip-text text-transparent">
              elevated.
            </span>
          </h1>
          <p className="text-slate-400 text-base mt-6 leading-relaxed max-w-md">
            Manage clients, accept requests, track earnings, and grow your wellness practice.
          </p>

          <div className="mt-10 space-y-3.5">
            {[
              { icon: IndianRupee, text: "Per-minute billing — 90% yours" },
              { icon: Users, text: "Built-in client CRM" },
              { icon: Activity, text: "Real-time request queue" },
              { icon: BarChart3, text: "Earnings & payout dashboard" },
              { icon: Star, text: "Reviews that build reputation" },
            ].map((f, i) => (
              <motion.div
                key={f.text}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="flex items-center gap-3 text-sm text-slate-300"
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <f.icon size={13} className="text-indigo-400" />
                </div>
                {f.text}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Not-a-consultant-yet banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="max-w-md"
        >
          <Link
            href="/consultant/register"
            className="group flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-indigo-950/60 border border-emerald-500/20 hover:border-emerald-500/50 transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform shrink-0">
              <Briefcase size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-sm">New consultant?</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Apply in under 3 minutes
              </p>
            </div>
            <ArrowRight size={16} className="text-emerald-400 group-hover:translate-x-1 transition-transform shrink-0" />
          </Link>
        </motion.div>
      </div>

      {/* ─── Right form ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden text-center mb-6">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center">
                <Briefcase size={18} className="text-white" />
              </div>
              <span className="text-white font-black text-lg tracking-wider">ZEAL</span>
            </Link>
          </div>

          <Link
            href="/consultant/register"
            className="lg:hidden flex items-center gap-3 p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 mb-6 active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
              <Briefcase size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-xs">New consultant?</p>
              <p className="text-[10px] text-slate-400">Apply in under 3 minutes</p>
            </div>
            <ArrowRight size={14} className="text-emerald-400 shrink-0" />
          </Link>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-3">
              <Briefcase size={11} /> Consultant
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Sign in to Command Center
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Manage your practice and clients
            </p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-start gap-2.5"
              >
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p>{error}</p>
                  {error.includes("isn't registered") && (
                    <div className="mt-2 pt-2 border-t border-rose-500/10 flex flex-wrap gap-3">
                      <Link href="/consultant/register" className="text-emerald-400 hover:text-emerald-300 font-black">
                        Apply as consultant →
                      </Link>
                      <Link href="/login" className="text-purple-400 hover:text-purple-300 font-black">
                        Seeker sign-in →
                      </Link>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            {phase !== "idle" && (
              <motion.div
                key="phase"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2.5"
              >
                <ShieldCheck size={14} />
                {phase === "verifying" ? "Verifying consultant access..." : "Access granted — entering console..."}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mb-6">
            <GoogleAuthButton
              label="Continue with Google"
              redirectPath="/consultant/dashboard"
              intent="consultant"
            />
          </div>

          <div className="relative flex items-center justify-center mb-6">
            <div className="border-t border-white/5 w-full" />
            <span className="bg-slate-950 px-4 text-[10px] uppercase tracking-[0.25em] text-slate-600 font-bold">
              or email
            </span>
            <div className="border-t border-white/5 w-full" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Consultant Email
              </label>
              <div className="relative group">
                <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="you@practice.com"
                  className={`w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-indigo-500 ${
                    touched.email && !emailValid && email.length > 0
                      ? "border-rose-500/50"
                      : "border-white/5"
                  }`}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Password
                </label>
                <Link href="/forgot-password" className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider">
                  Forgot?
                </Link>
              </div>
              <div className="relative group">
                <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  placeholder="••••••••••••"
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-slate-300 transition-colors rounded-lg hover:bg-white/5"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !formValid}
              className="btn-3d w-full py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {phase === "verifying" ? "Verifying..." : "Entering console..."}
                </>
              ) : (
                <>
                  Enter Command Center <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <div className="mt-7 pt-6 border-t border-white/5 text-center space-y-3">
            <p className="text-xs text-slate-500">
              Not registered as a consultant?{" "}
              <Link href="/consultant/register" className="text-emerald-400 hover:text-emerald-300 font-bold">
                Apply now
              </Link>
            </p>
            <p className="text-[11px] text-slate-600">
              Looking for a session?{" "}
              <Link href="/login" className="text-purple-400 hover:text-purple-300 font-bold">
                Seeker sign-in
              </Link>
            </p>
          </div>

          <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-center gap-6 text-[10px] text-slate-600">
            <span className="flex items-center gap-1.5">
              <MessageSquare size={10} /> Chat
            </span>
            <span className="flex items-center gap-1.5">
              <Video size={10} /> Video
            </span>
            <span className="flex items-center gap-1.5">
              <IndianRupee size={10} /> Per-minute billing
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function ConsultantLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
      }
    >
      <ConsultantLoginContent />
    </Suspense>
  );
}
CONSULTANT_LOGIN
ok "written"

# ═══════════════════════════════════════════════════════════════════════════════
# 4/4 — apps/web/app/consultant/register/page.tsx (NEW)
# ═══════════════════════════════════════════════════════════════════════════════
h "4/4 — apps/web/app/consultant/register/page.tsx (NEW)"
mkdir -p apps/web/app/consultant/register
cat > apps/web/app/consultant/register/page.tsx << 'CONSULTANT_REGISTER'
"use client";

import { useState, useMemo } from "react";
import { registerAction } from "@/actions/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Briefcase, Loader2, Mail, Lock, User as UserIcon,
  ArrowRight, AlertCircle, Check, Eye, EyeOff, Sparkles,
  IndianRupee, Users, Activity, BarChart3, Star, ShieldCheck,
} from "lucide-react";

type Strength = 0 | 1 | 2 | 3 | 4;
const META: Record<Strength, { label: string; color: string; width: string }> = {
  0: { label: "", color: "", width: "0%" },
  1: { label: "Weak", color: "bg-rose-500", width: "20%" },
  2: { label: "Fair", color: "bg-amber-500", width: "45%" },
  3: { label: "Good", color: "bg-blue-500", width: "70%" },
  4: { label: "Strong", color: "bg-emerald-500", width: "100%" },
};

function strength(pw: string): Strength {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 12) s++;
  if (pw.length >= 16) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4) as Strength;
}

export default function ConsultantRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const s = useMemo(() => strength(password), [password]);
  const meta = META[s];
  const passwordOk = password.length >= 12;
  const matches = password === confirm && confirm.length > 0;
  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);
  const nameValid = fullName.trim().length >= 2;
  const canSubmit = nameValid && emailValid && passwordOk && matches && agreed && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");

    const fd = new FormData();
    fd.append("fullName", fullName.trim());
    fd.append("email", email.trim().toLowerCase());
    fd.append("password", password);
    fd.append("accountType", "consultant");  // → routes to /apply

    const res = await registerAction(fd);

    if (res.success && res.destination) {
      router.push(res.destination);
    } else {
      setError(res.error || "Registration failed.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex relative overflow-hidden">
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-indigo-600/10 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-emerald-600/6 blur-[160px] rounded-full pointer-events-none" />

      {/* ─── Left panel ─────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-14 border-r border-white/5">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 group-hover:scale-105 transition-transform">
              <Briefcase size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white font-black tracking-wider text-lg leading-none">ZEAL</p>
              <p className="text-[10px] text-slate-500 tracking-[0.2em] font-bold uppercase mt-0.5">
                Practice Console
              </p>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.7 }}
          className="max-w-lg"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-6">
            <Sparkles size={12} /> Join the network
          </div>
          <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight">
            Launch your
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
              practice.
            </span>
          </h1>
          <p className="text-slate-400 text-base mt-6 leading-relaxed max-w-md">
            Register in under a minute. Complete a 3-step verification, then start earning.
          </p>

          <div className="mt-10 space-y-3.5">
            {[
              { icon: IndianRupee, text: "Keep 90% of every session" },
              { icon: Users, text: "Client CRM + booking history" },
              { icon: Activity, text: "Real-time seeker requests" },
              { icon: BarChart3, text: "Live earnings dashboard" },
              { icon: Star, text: "Reviews that build your reputation" },
            ].map((f, i) => (
              <motion.div
                key={f.text}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="flex items-center gap-3 text-sm text-slate-300"
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <f.icon size={13} className="text-indigo-400" />
                </div>
                {f.text}
              </motion.div>
            ))}
          </div>

          <div className="mt-10 p-4 rounded-2xl bg-slate-900/60 border border-white/5">
            <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-black uppercase tracking-widest mb-2">
              <ShieldCheck size={11} /> Application Flow
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="text-white font-bold">1. Create account</span>
              <ArrowRight size={11} className="text-slate-600" />
              <span className="text-white font-bold">2. Verify discipline</span>
              <ArrowRight size={11} className="text-slate-600" />
              <span className="text-white font-bold">3. Go live</span>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="flex items-center gap-6 text-[11px] text-slate-600">
          <span>© 2026 Zeal</span>
          <span>•</span>
          <span>90% revenue share</span>
          <span>•</span>
          <span>No monthly fee</span>
        </motion.div>
      </div>

      {/* ─── Right form ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden text-center mb-6">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center">
                <Briefcase size={18} className="text-white" />
              </div>
              <span className="text-white font-black text-lg tracking-wider">ZEAL</span>
            </Link>
          </div>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-3">
              <Briefcase size={11} /> Consultant
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Create consultant account
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Free to apply — no monthly fees
            </p>
          </div>

          <div className="mb-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">
            <div className="font-black flex items-center gap-2 text-indigo-200 mb-1.5">
              <ShieldCheck size={14} /> Fast-track onboarding
            </div>
            <p className="text-[11px] leading-relaxed text-indigo-300/80">
              After account creation you'll be routed to a 3-step verification form.
              Approval typically takes under 24 hours.
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-start gap-2.5"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <div className="mb-6">
            <GoogleAuthButton
              label="Sign up with Google"
              redirectPath="/apply"
              intent="consultant"
            />
          </div>

          <div className="relative flex items-center justify-center mb-6">
            <div className="border-t border-white/5 w-full" />
            <span className="bg-slate-950 px-4 text-[10px] uppercase tracking-[0.25em] text-slate-600 font-bold">
              or email
            </span>
            <div className="border-t border-white/5 w-full" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Legal Name
              </label>
              <div className="relative group">
                <UserIcon size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Aacharya Sharma"
                  autoComplete="name"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Email
              </label>
              <div className="relative group">
                <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@practice.com"
                  autoComplete="email"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Password
              </label>
              <div className="relative group">
                <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 12 characters"
                  autoComplete="new-password"
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-slate-300 transition-colors rounded-lg hover:bg-white/5"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {password.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        animate={{ width: meta.width }}
                        transition={{ duration: 0.4 }}
                        className={`h-full ${meta.color} rounded-full`}
                      />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      s <= 1 ? "text-rose-400" :
                      s === 2 ? "text-amber-400" :
                      s === 3 ? "text-blue-400" : "text-emerald-400"
                    }`}>{meta.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {passwordOk
                      ? "✓ Meets 12-character minimum"
                      : `${12 - password.length} more character${12 - password.length === 1 ? "" : "s"} required`}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Confirm Password
              </label>
              <div className="relative group">
                <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  className={`w-full pl-12 pr-12 py-3.5 bg-slate-900/60 border rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-indigo-500 ${
                    confirm.length > 0 && !matches ? "border-rose-500/40" : "border-white/5"
                  }`}
                />
                {matches && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <Check size={12} className="text-emerald-400" />
                  </div>
                )}
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer py-2">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-5 h-5 rounded-md border-2 border-white/10 bg-slate-900/60 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all flex items-center justify-center">
                  {agreed && <Check size={12} className="text-white" />}
                </div>
              </div>
              <span className="text-[11px] text-slate-500 leading-relaxed">
                I agree to Zeal's{" "}
                <Link href="/terms" className="text-indigo-400 hover:text-indigo-300 font-bold">Terms</Link>
                {" "}and{" "}
                <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300 font-bold">Privacy Policy</Link>.
              </span>
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-3d w-full py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Creating account...</>
              ) : (
                <>Continue to Application <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <div className="mt-7 pt-6 border-t border-white/5 text-center space-y-3">
            <p className="text-xs text-slate-500">
              Already a consultant?{" "}
              <Link href="/consultant/login" className="text-indigo-400 hover:text-indigo-300 font-bold">
                Sign in
              </Link>
            </p>
            <p className="text-[11px] text-slate-600">
              Looking for a session?{" "}
              <Link href="/register" className="text-purple-400 hover:text-purple-300 font-bold">
                Seeker signup
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
CONSULTANT_REGISTER
ok "written"

# ═══════════════════════════════════════════════════════════════════════════════
# Verify
# ═══════════════════════════════════════════════════════════════════════════════
h "VERIFY"

info "Type-check web..."
TC=$(npm run type-check --workspace=web 2>&1 || true)
if echo "$TC" | grep -qE "error TS"; then
  warn "Errors:"
  echo "$TC" | grep "error TS" | head -10
  E=$((E+1))
else
  ok "web type-check passed"
fi

info "Verifying Suspense import fixed..."
if grep -q "import { useState, useMemo, Suspense }" apps/web/app/register/page.tsx; then
  ok "Suspense imported"
else
  warn "Suspense import pattern mismatch — check manually"
fi

echo ""
echo -e "${BOLD}═══ FILES STAGED (not committed, not pushed) ═══${NC}"
git add -A
git reset -- _archive/ 2>/dev/null || true
git status --short | head -20

echo ""
echo -e "${BOLD}To commit:${NC}"
echo "  git commit -m \"Consultant auth flow: dedicated login + register + seeker routes\""
echo ""
echo -e "${BOLD}To push:${NC}"
echo "  git push origin main"
echo ""

if [[ $E -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║  READY — NO PUSH (as requested)                                ║${NC}"
  echo -e "${GREEN}${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
else
  echo -e "${RED}${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}${BOLD}║  ${E} TYPE ERROR(S) — FIX BEFORE COMMIT                          ║${NC}"
  echo -e "${RED}${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
fi

exit 0
