#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — PHASE 3: UNIFIED AUTH UI
# ═══════════════════════════════════════════════════════════════════════════════
# Writes 2 enterprise-grade pages:
#   apps/web/app/login/page.tsx      — unified sign-in (all roles)
#   apps/web/app/register/page.tsx   — unified sign-up with role toggle
#
# Guarantees:
#   • Idempotent: safe to re-run any number of times
#   • Typecheck-gated: refuses to commit if tsc fails
#   • Every mutation backed up to _archive/
#   • MINGW64 / Git Bash / macOS / Linux safe
# ═══════════════════════════════════════════════════════════════════════════════
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo /d/zeal)" || exit 1

# ─── Colors ───────────────────────────────────────────────────────────────────
R=$'\033[0;31m'; G=$'\033[0;32m'; Y=$'\033[1;33m'; B=$'\033[0;34m'
M=$'\033[0;35m'; C=$'\033[0;36m'; D=$'\033[2m'; BOLD=$'\033[1m'; N=$'\033[0m'
[[ ! -t 1 ]] && { R=''; G=''; Y=''; B=''; M=''; C=''; D=''; BOLD=''; N=''; }

info()   { printf "${B}[INFO]${N}    %s\n" "$1"; }
ok()     { printf "${G}[OK]${N}      %s\n" "$1"; }
warn()   { printf "${Y}[WARN]${N}    %s\n" "$1"; }
err()    { printf "${R}[ERR]${N}     %s\n" "$1"; }
detail() { printf "${D}          → %s${N}\n" "$1"; }
did()    { printf "${M}[FIXED]${N}   %s\n" "$1"; }
sect()   {
  printf "\n${BOLD}═══════════════════════════════════════════════════════════════${N}\n"
  printf "${BOLD}  %s${N}\n" "$1"
  printf "${BOLD}═══════════════════════════════════════════════════════════════${N}\n"
}

PASS=0; FAIL=0; SKIP=0; FIXED=0; TC=1
pass() { PASS=$((PASS+1)); ok "$1"; }
fail() { FAIL=$((FAIL+1)); err "$1"; }
skip() { SKIP=$((SKIP+1)); warn "$1"; }
did_fix() { FIXED=$((FIXED+1)); did "$1"; }
to_int() { local v="${1:-0}"; v="$(printf '%s' "$v" | tr -d '[:space:]')"; [[ "$v" =~ ^[0-9]+$ ]] && echo "$v" || echo 0; }

TS=$(date +%Y%m%d-%H%M%S)
BACKUP="_archive/phase3-${TS}"
mkdir -p "$BACKUP"

printf "\n${BOLD}╔═══════════════════════════════════════════════════════════════╗${N}\n"
printf "${BOLD}║   ZEAL — PHASE 3: UNIFIED AUTH UI                             ║${N}\n"
printf "${BOLD}╚═══════════════════════════════════════════════════════════════╝${N}\n"

# ═══════════════════════════════════════════════════════════════════════════════
sect "Preflight"
# ═══════════════════════════════════════════════════════════════════════════════
[[ -d "apps/web/app" ]] || { err "apps/web/app missing"; exit 1; }
grep -q 'export async function loginAction' apps/web/actions/auth.ts 2>/dev/null \
  || { err "Phase 2 required (loginAction not found)"; exit 1; }
pass "Repo: $(pwd)"
pass "Phase 2 detected"
mkdir -p "$BACKUP" && pass "Backup: $BACKUP"

backup_file() {
  [[ -f "$1" ]] && cp "$1" "$BACKUP/$(echo "$1" | sed 's|/|_|g').bak" 2>/dev/null || true
}

# ═══════════════════════════════════════════════════════════════════════════════
sect "Write apps/web/app/login/page.tsx"
# ═══════════════════════════════════════════════════════════════════════════════
LOGIN="apps/web/app/login/page.tsx"
backup_file "$LOGIN"
mkdir -p "$(dirname "$LOGIN")"

cat > "$LOGIN" << 'ZEAL_LOGIN'
"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, ArrowRight, Briefcase, Check, Compass, Eye, EyeOff,
  Loader2, Lock, Mail, MailCheck, ShieldCheck, Sparkles,
} from "lucide-react";
import { loginAction, type LoginResult } from "@/actions/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";

const ERROR_COPY: Record<string, string> = {
  INVALID_CREDENTIALS: "Email or password is incorrect.",
  RATE_LIMITED:        "Too many attempts. Please wait a minute.",
  INTERNAL:            "Something went wrong. Please try again.",
};

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirectedFrom") ?? "";
  const justRegistered = params.get("registered") === "1";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);

  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email],
  );
  const canSubmit = emailValid && password.length > 0 && !loading;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    if (redirectTo) fd.append("redirectTo", redirectTo);

    const res: LoginResult = await loginAction(fd);
    if (res.ok) {
      if (res.destination.startsWith("http")) {
        window.location.href = res.destination;
      } else {
        router.push(res.destination);
      }
      return;
    }
    setError(ERROR_COPY[res.code] ?? res.error);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-purple-600/10 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-600/8 blur-[160px] rounded-full pointer-events-none" />

      <aside className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-14 border-r border-white/5">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-purple-500/30">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-black tracking-wider text-lg leading-none">ZEAL</p>
            <p className="text-[10px] text-slate-500 tracking-[0.2em] font-bold uppercase mt-0.5">
              Wellness Universe
            </p>
          </div>
        </Link>

        <div className="max-w-lg">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-6">
            <ShieldCheck size={12} /> One account · every role
          </div>
          <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight">
            Sign in to
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
              your universe.
            </span>
          </h1>
          <p className="text-slate-400 text-base mt-6 max-w-md">
            Seekers, consultants, and administrators — one door.
            We route you to the right dashboard automatically.
          </p>
          <ul className="mt-10 space-y-3.5">
            {[
              "Seeker → explore 37+ traditions",
              "Consultant → Command Center + CRM",
              "Admin → God-View console with audit log",
              "Two-factor authentication ready",
            ].map((f, i) => (
              <motion.li
                key={f}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="flex items-center gap-3 text-sm text-slate-300"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                  <Check size={11} className="text-emerald-400" />
                </div>
                {f}
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-6 text-[11px] text-slate-600">
          <span>© 2026 Zeal</span><span>•</span>
          <span>SOC 2 Type II</span><span>•</span><span>GDPR Compliant</span>
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center p-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center">
                <Sparkles size={18} className="text-white" />
              </div>
              <span className="text-white font-black text-lg tracking-wider">ZEAL</span>
            </Link>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">Welcome back</h2>
            <p className="text-sm text-slate-500 mt-1">Sign in with email or Google</p>
          </div>

          <AnimatePresence>
            {justRegistered && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-start gap-2.5"
              >
                <MailCheck size={14} className="mt-0.5 shrink-0" />
                <span>Account created! Check your email to confirm, then sign in.</span>
              </motion.div>
            )}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-start gap-2.5"
              >
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
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

          <form onSubmit={submit} className="space-y-4">
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
                  onBlur={() => setTouched(true)}
                  placeholder="you@example.com"
                  className={`w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-purple-500 ${
                    touched && !emailValid && email.length > 0 ? "border-rose-500/40" : "border-white/5"
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
                  type={show ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-slate-300 rounded-lg hover:bg-white/5"
                >
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-3d w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Signing in...</>
                : <>Sign in <ArrowRight size={15} /></>}
            </button>
          </form>

          <div className="my-7 relative flex items-center justify-center">
            <div className="border-t border-white/5 w-full" />
            <span className="bg-slate-950 px-4 text-[10px] uppercase tracking-[0.25em] text-slate-600 font-bold">
              new here?
            </span>
            <div className="border-t border-white/5 w-full" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link href="/register" className="group p-4 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-purple-500/40 hover:bg-slate-900/90 transition-all">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center mb-3">
                <Compass size={16} className="text-purple-400" />
              </div>
              <p className="text-white font-bold text-sm">Join as Seeker</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Explore & consult</p>
            </Link>
            <Link href="/register?type=consultant" className="group p-4 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-indigo-500/40 hover:bg-slate-900/90 transition-all">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center mb-3">
                <Briefcase size={16} className="text-indigo-400" />
              </div>
              <p className="text-white font-bold text-sm">Join as Guide</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Practice & earn</p>
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <LoginContent />
    </Suspense>
  );
}
ZEAL_LOGIN

[[ -f "$LOGIN" ]] && did_fix "login/page.tsx written ($(wc -l < "$LOGIN" | tr -d ' ') lines)" || fail "login write failed"

# ═══════════════════════════════════════════════════════════════════════════════
sect "Write apps/web/app/register/page.tsx"
# ═══════════════════════════════════════════════════════════════════════════════
REG="apps/web/app/register/page.tsx"
backup_file "$REG"
mkdir -p "$(dirname "$REG")"

cat > "$REG" << 'ZEAL_REGISTER'
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, ArrowRight, Briefcase, Check, Compass, Eye, EyeOff,
  Loader2, Lock, Mail, MailCheck, ShieldCheck, Sparkles, User as UserIcon,
} from "lucide-react";
import { registerAction, type RegisterResult } from "@/actions/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";

type Role = "user" | "consultant";
type Strength = 0 | 1 | 2 | 3 | 4;

const STRENGTH_META: Record<Strength, { label: string; color: string; width: string }> = {
  0: { label: "", color: "", width: "0%" },
  1: { label: "Weak", color: "bg-rose-500", width: "20%" },
  2: { label: "Fair", color: "bg-amber-500", width: "45%" },
  3: { label: "Good", color: "bg-blue-500", width: "70%" },
  4: { label: "Strong", color: "bg-emerald-500", width: "100%" },
};

function scorePassword(pw: string): Strength {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 12) s++;
  if (pw.length >= 16) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4) as Strength;
}

const ERROR_COPY: Record<string, string> = {
  VALIDATION:     "Please check your input and try again.",
  WEAK_PASSWORD:  "Password must be at least 12 characters.",
  EMAIL_EXISTS:   "An account with this email already exists.",
  RATE_LIMITED:   "Too many attempts. Try again in a minute.",
  INTERNAL:       "Something went wrong. Please try again.",
};

function RegisterContent() {
  const router = useRouter();
  const params = useSearchParams();

  const [role, setRole] = useState<Role>("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const strength = useMemo(() => scorePassword(password), [password]);
  const meta = STRENGTH_META[strength];
  const passwordOk = password.length >= 12;
  const matches = password === confirm && confirm.length > 0;
  const emailOk = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);
  const nameOk = fullName.trim().length >= 2;
  const canSubmit = nameOk && emailOk && passwordOk && matches && agreed && !loading;

  useEffect(() => {
    if (params.get("type") === "consultant") setRole("consultant");
  }, [params]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("fullName", fullName.trim());
    fd.append("email", email.trim().toLowerCase());
    fd.append("password", password);
    fd.append("accountType", role);

    const res: RegisterResult = await registerAction(fd);
    if (res.ok) {
      if (res.needsConfirmation) {
        setNeedsConfirm(true);
        setLoading(false);
        return;
      }
      if (res.destination.startsWith("http")) {
        window.location.href = res.destination;
      } else {
        router.push(res.destination);
      }
      return;
    }
    setError(ERROR_COPY[res.code] ?? res.error);
    setLoading(false);
  };

  if (needsConfirm) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
            <Mail size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Check your inbox</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            We sent a confirmation link to <strong className="text-white">{email}</strong>.
            Click it, then come back and sign in.
          </p>
          <Link
            href="/login?registered=1"
            className="inline-flex items-center gap-2 mt-8 px-6 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-black text-sm"
          >
            Go to Sign In <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex relative overflow-hidden">
      <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/8 blur-[160px] rounded-full pointer-events-none" />

      <aside className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-14 border-r border-white/5">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-purple-500/30">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-black tracking-wider text-lg leading-none">ZEAL</p>
            <p className="text-[10px] text-slate-500 tracking-[0.2em] font-bold uppercase mt-0.5">
              Wellness Universe
            </p>
          </div>
        </Link>

        <div className="max-w-lg">
          <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight">
            Begin your
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
              journey.
            </span>
          </h1>
          <p className="text-slate-400 text-base mt-6 max-w-md">
            One account. Choose your path — seeker or practitioner.
          </p>
          <ul className="mt-10 space-y-3.5">
            {[
              "Free forever — no subscription",
              "Seeker: instant access to explore",
              "Consultant: verified instantly, no approval queue",
              "90% revenue share on every session",
            ].map((f, i) => (
              <motion.li
                key={f}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="flex items-center gap-3 text-sm text-slate-300"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                  <Check size={11} className="text-emerald-400" />
                </div>
                {f}
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-6 text-[11px] text-slate-600">
          <span>© 2026 Zeal</span><span>•</span><span>SOC 2</span><span>•</span><span>GDPR</span>
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center p-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center">
                <Sparkles size={18} className="text-white" />
              </div>
              <span className="text-white font-black text-lg tracking-wider">ZEAL</span>
            </Link>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">Create your account</h2>
            <p className="text-sm text-slate-500 mt-1">
              {role === "consultant" ? "Start your practice instantly" : "Free forever — no subscription"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-white/5 mb-6">
            <button
              type="button"
              onClick={() => setRole("user")}
              className={`py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                role === "user"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Compass size={14} /> Seeker
            </button>
            <button
              type="button"
              onClick={() => setRole("consultant")}
              className={`py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                role === "consultant"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Briefcase size={14} /> Consultant
            </button>
          </div>

          <AnimatePresence>
            {role === "consultant" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-6"
              >
                <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">
                  <div className="font-black flex items-center gap-2 text-indigo-200 mb-1.5">
                    <ShieldCheck size={14} /> Instant activation
                  </div>
                  <p className="text-[11px] leading-relaxed text-indigo-300/80">
                    No approval queue. You'll be live the moment you sign up —
                    complete your profile to maximize visibility.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
              label={role === "consultant" ? "Sign up with Google" : "Continue with Google"}
              redirectPath={role === "consultant" ? "/consultant/dashboard" : "/explore"}
              intent={role}
            />
          </div>

          <div className="relative flex items-center justify-center mb-6">
            <div className="border-t border-white/5 w-full" />
            <span className="bg-slate-950 px-4 text-[10px] uppercase tracking-[0.25em] text-slate-600 font-bold">
              or email
            </span>
            <div className="border-t border-white/5 w-full" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Full Name
              </label>
              <div className="relative group">
                <UserIcon size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none focus:bg-slate-900/90 focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Email
              </label>
              <div className="relative group">
                <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none focus:bg-slate-900/90 focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Password
              </label>
              <div className="relative group">
                <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400" />
                <input
                  type={showPw ? "text" : "password"}
                  required
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 12 characters"
                  autoComplete="new-password"
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none focus:bg-slate-900/90 focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-slate-300 rounded-lg hover:bg-white/5"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
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
                      strength <= 1 ? "text-rose-400"
                      : strength === 2 ? "text-amber-400"
                      : strength === 3 ? "text-blue-400"
                      : "text-emerald-400"
                    }`}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {passwordOk
                      ? "✓ 12-character minimum met"
                      : `${12 - password.length} more character${12 - password.length === 1 ? "" : "s"}`}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Confirm Password
              </label>
              <div className="relative group">
                <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400" />
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  className={`w-full pl-12 pr-12 py-3.5 bg-slate-900/60 border rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none focus:bg-slate-900/90 focus:border-purple-500 ${
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

            <label className="flex items-start gap-3 cursor-pointer group py-2">
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
                <>{role === "consultant" ? "Create Consultant Account" : "Create Seeker Account"} <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-7">
            Already have an account?{" "}
            <Link href="/login" className="text-purple-400 hover:text-purple-300 font-bold">
              Sign in
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <RegisterContent />
    </Suspense>
  );
}
ZEAL_REGISTER

[[ -f "$REG" ]] && did_fix "register/page.tsx written ($(wc -l < "$REG" | tr -d ' ') lines)" || fail "register write failed"

# ═══════════════════════════════════════════════════════════════════════════════
sect "Redirect legacy consultant auth pages"
# ═══════════════════════════════════════════════════════════════════════════════
CLOGIN="apps/web/app/consultant/login/page.tsx"
CREG="apps/web/app/consultant/register/page.tsx"

backup_file "$CLOGIN"
mkdir -p "$(dirname "$CLOGIN")"
cat > "$CLOGIN" << 'CLOGIN_REDIRECT'
import { redirect } from "next/navigation";
export default function ConsultantLoginRedirect() {
  redirect("/login?type=consultant");
}
CLOGIN_REDIRECT
did_fix "consultant/login → /login"

backup_file "$CREG"
mkdir -p "$(dirname "$CREG")"
cat > "$CREG" << 'CREG_REDIRECT'
import { redirect } from "next/navigation";
export default function ConsultantRegisterRedirect() {
  redirect("/register?type=consultant");
}
CREG_REDIRECT
did_fix "consultant/register → /register?type=consultant"

# ═══════════════════════════════════════════════════════════════════════════════
sect "Typecheck gate"
# ═══════════════════════════════════════════════════════════════════════════════
info "Running tsc on apps/web..."
pushd apps/web >/dev/null
if npx --no-install tsc --noEmit --pretty false > /tmp/zeal-p3-web.log 2>&1; then
  pass "apps/web clean"
  TC=0
else
  EC=$(to_int "$(grep -c 'error TS' /tmp/zeal-p3-web.log)")
  fail "apps/web: $EC errors"
  grep 'error TS' /tmp/zeal-p3-web.log | head -20 | sed 's/^/    /'
  TC=1
fi
popd >/dev/null

# ═══════════════════════════════════════════════════════════════════════════════
sect "SUMMARY"
# ═══════════════════════════════════════════════════════════════════════════════
printf "  ${G}Passed:${N}   %d\n" "$PASS"
printf "  ${M}Fixed:${N}    %d\n" "$FIXED"
printf "  ${Y}Skipped:${N}  %d\n" "$SKIP"
[[ $FAIL -gt 0 ]] && printf "  ${R}Failed:${N}   %d\n" "$FAIL" || printf "  ${D}Failed:   0${N}\n"
printf "  ${BOLD}Typecheck:${N} %s\n" "$([[ $TC -eq 0 ]] && echo PASS || echo FAIL)"
printf "\n  ${BOLD}Backups:${N}  %s\n\n" "$BACKUP"

if [[ $FAIL -eq 0 && $TC -eq 0 ]]; then
  printf "${G}${BOLD}╔═══════════════════════════════════════════════════════════════╗${N}\n"
  printf "${G}${BOLD}║   ✓ PHASE 3 READY — commit with:                              ║${N}\n"
  printf "${G}${BOLD}║                                                               ║${N}\n"
  printf "${G}${BOLD}║   git add apps/web/app/login apps/web/app/register \\          ║${N}\n"
  printf "${G}${BOLD}║          apps/web/app/consultant/login \\                      ║${N}\n"
  printf "${G}${BOLD}║          apps/web/app/consultant/register                     ║${N}\n"
  printf "${G}${BOLD}║   git commit -m 'Phase 3: unified auth UI'                    ║${N}\n"
  printf "${G}${BOLD}║   git push origin main                                        ║${N}\n"
  printf "${G}${BOLD}╚═══════════════════════════════════════════════════════════════╝${N}\n"
else
  printf "${R}${BOLD}╔═══════════════════════════════════════════════════════════════╗${N}\n"
  printf "${R}${BOLD}║   Errors remain — review output above                         ║${N}\n"
  printf "${R}${BOLD}╚═══════════════════════════════════════════════════════════════╝${N}\n"
fi
echo ""
exit $([[ $FAIL -eq 0 && $TC -eq 0 ]] && echo 0 || echo 1)
