cat > premium-auth-frontend.sh << 'ENDOFSCRIPT'
#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — PREMIUM AUTH FRONTEND (admin + unified + consultant)
# ═══════════════════════════════════════════════════════════════════════════════
# 4 files rewritten to enterprise-grade polish:
#   apps/admin/app/login/page.tsx       — terminal-grade admin auth
#   apps/web/app/login/page.tsx         — split-screen premium login
#   apps/web/app/register/page.tsx      — multi-step registration
#   apps/web/app/apply/page.tsx         — consultant wizard w/ live preview
# Preserves: btn-3d, glass-card-3d, #9D7DC5/#533AFD, dark-first, framer-motion
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
ARCHIVE="_archive/premium-auth-${TS}"
mkdir -p "$ARCHIVE"
E=0

backup() {
  local f="$1"
  [[ -f "$f" ]] && cp "$f" "${ARCHIVE}/backup-$(echo "$f" | sed 's|/|_|g')"
}

echo ""
echo -e "${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  ZEAL — PREMIUM AUTH FRONTEND                                  ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"

# ═══════════════════════════════════════════════════════════════════════════════
# 1/4 — apps/admin/app/login/page.tsx  (Terminal-grade)
# ═══════════════════════════════════════════════════════════════════════════════
h "1/4 — apps/admin/app/login/page.tsx"
backup apps/admin/app/login/page.tsx
mkdir -p apps/admin/app/login
cat > apps/admin/app/login/page.tsx << 'ADMIN_LOGIN'
"use client";

import { useState, useEffect, Suspense } from "react";
import { adminLoginAction } from "@/actions/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert, Lock, Mail, Loader2, Server, Timer, Terminal,
  Activity, Wifi, WifiOff, ChevronRight, Fingerprint, AlertTriangle,
} from "lucide-react";

function AdminLoginContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "verifying" | "granted">("idle");
  const [lockSeconds, setLockSeconds] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [time, setTime] = useState(new Date());
  const [online, setOnline] = useState(true);
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    const o = setInterval(() => setOnline(navigator.onLine), 5000);
    return () => { clearInterval(t); clearInterval(o); };
  }, []);

  useEffect(() => {
    const urlError = params.get("error");
    if (urlError === "unauthorized") setError("Access denied — admin clearance required.");
  }, [params]);

  useEffect(() => {
    if (lockSeconds <= 0) return;
    const t = setInterval(() => setLockSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [lockSeconds]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (lockSeconds > 0) return;

    setLoading(true);
    setError("");
    setPhase("verifying");

    const fd = new FormData(e.currentTarget);
    const res = await adminLoginAction(fd);

    if (res.success && res.destination) {
      setPhase("granted");
      setTimeout(() => router.push(res.destination), 800);
    } else {
      const msg = res.error || "Authentication failed.";
      setError(msg);
      if (/lock|too many|rate/i.test(msg)) setLockSeconds(15 * 60);
      setPhase("idle");
      setLoading(false);
    }
  };

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  const locked = lockSeconds > 0;
  const canSubmit = email.length > 0 && password.length > 0 && !locked && !loading;

  return (
    <div className="min-h-screen bg-black flex relative overflow-hidden font-mono">
      {/* Ambient layers */}
      <div className="absolute inset-0 opacity-[0.15] bg-[radial-gradient(ellipse_at_center,rgba(244,63,94,0.4),transparent_50%)]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-rose-600/10 blur-[200px] rounded-full pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-between p-12 border-r border-white/5">
        <div>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3"
          >
            <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
              <Terminal size={20} className="text-rose-500" />
            </div>
            <div>
              <p className="text-[10px] text-rose-500/70 tracking-[0.3em] font-bold uppercase">
                Project Zeal
              </p>
              <p className="text-white text-sm font-black tracking-wider">CORE CONSOLE</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mt-24"
          >
            <h1 className="text-6xl font-black text-white leading-[0.95] tracking-tight">
              God-View
              <br />
              <span className="text-rose-500">Clearance</span>
            </h1>
            <p className="text-zinc-500 text-sm mt-6 max-w-md leading-relaxed">
              Restricted infrastructure node. Every action audited.
              Unauthorized access attempts are logged and reported.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 space-y-3 text-xs"
          >
            <div className="flex items-center gap-3 text-zinc-500">
              <div className={`w-1.5 h-1.5 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              <span className="uppercase tracking-widest">Node Status:</span>
              <span className={online ? "text-emerald-400" : "text-rose-400"}>
                {online ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-zinc-500">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="uppercase tracking-widest">Encryption:</span>
              <span className="text-emerald-400">AES-256-GCM</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-500">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="uppercase tracking-widest">Audit Log:</span>
              <span className="text-emerald-400">ACTIVE</span>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="space-y-2 text-xs text-zinc-600"
        >
          <p>
            <span className="text-zinc-500">TIME:</span>{" "}
            <span className="text-zinc-300 font-mono">{time.toLocaleTimeString("en-GB")}</span>
          </p>
          <p>
            <span className="text-zinc-500">REGION:</span>{" "}
            <span className="text-zinc-300">bom1 / ap-south-1</span>
          </p>
          <p className="pt-3 text-zinc-700">© 2026 ZEAL Core — All access monitored</p>
        </motion.div>
      </div>

      {/* Right auth panel */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-14 h-14 mx-auto bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mb-3">
              <Terminal size={24} className="text-rose-500" />
            </div>
            <p className="text-white text-lg font-black tracking-widest">ZEAL CORE</p>
          </div>

          {/* Console card */}
          <div className="relative">
            {/* Terminal header bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-950 border border-white/5 border-b-0 rounded-t-2xl">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
              </div>
              <span className="ml-3 text-[10px] text-zinc-600 tracking-widest">
                zeal-core · auth.node
              </span>
              <div className="ml-auto flex items-center gap-2 text-[10px] text-zinc-600">
                {online ? <Wifi size={11} /> : <WifiOff size={11} />}
              </div>
            </div>

            <div className="bg-zinc-950/80 backdrop-blur-2xl border border-white/5 rounded-b-2xl p-8 shadow-2xl">
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="text-rose-500" size={16} />
                  <span className="text-[10px] text-rose-500 tracking-[0.2em] font-bold uppercase">
                    Restricted Access Node
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Authorize Session
                </h2>
                <p className="text-xs text-zinc-500 mt-1.5">
                  Admin credentials required for entry
                </p>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-5 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-start gap-2.5"
                  >
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {locked && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-5 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400"
                  >
                    <div className="flex items-center gap-2 mb-1 text-[10px] tracking-[0.2em] font-bold uppercase">
                      <Timer size={12} /> Access Locked
                    </div>
                    <p className="text-2xl font-black font-mono tracking-widest text-amber-300">
                      {formatCountdown(lockSeconds)}
                    </p>
                    <p className="text-[10px] mt-1 text-amber-500/70">
                      Too many failed attempts. Retry after timer.
                    </p>
                  </motion.div>
                )}

                {phase === "granted" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-5 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold text-center"
                  >
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Fingerprint size={14} />
                      <span className="tracking-[0.2em] uppercase">Access Granted</span>
                    </div>
                    <p className="text-[10px] text-emerald-500/70">
                      Routing to command center...
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase mb-2">
                    Identity
                  </label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500/50 text-xs font-mono select-none">
                      $
                    </span>
                    <Mail
                      size={14}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-rose-500 transition-colors"
                    />
                    <input
                      name="email"
                      type="email"
                      required
                      disabled={locked}
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@zeal.com"
                      className="w-full pl-8 pr-11 py-3.5 bg-black border border-white/5 rounded-lg text-sm font-mono text-white placeholder:text-zinc-700 outline-none focus:border-rose-500/50 focus:bg-black transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase mb-2">
                    Passphrase
                  </label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500/50 text-xs font-mono select-none">
                      $
                    </span>
                    <Lock
                      size={14}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-rose-500 transition-colors"
                    />
                    <input
                      name="password"
                      type="password"
                      required
                      disabled={locked}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-8 pr-11 py-3.5 bg-black border border-white/5 rounded-lg text-sm font-mono text-white placeholder:text-zinc-700 outline-none focus:border-rose-500/50 focus:bg-black transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full py-4 mt-3 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-black text-xs tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-[0_0_40px_-10px_rgba(244,63,94,0.5)]"
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>{phase === "verifying" ? "VERIFYING..." : "AUTHORIZING..."}</span>
                    </>
                  ) : locked ? (
                    <>
                      <Timer size={14} />
                      <span>LOCKED</span>
                    </>
                  ) : (
                    <>
                      <Fingerprint size={14} />
                      <span>AUTHORIZE</span>
                      <ChevronRight size={14} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-600 font-mono">
                <span className="flex items-center gap-1.5">
                  <Activity size={10} className="text-emerald-500" />
                  SESSION MONITORED
                </span>
                <span>v2.4.1</span>
              </div>
            </div>
          </div>

          <p className="text-center text-[10px] text-zinc-700 mt-6 font-mono tracking-widest">
            UNAUTHORIZED ACCESS IS PROHIBITED AND LOGGED
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default function AdminLogin() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <Loader2 className="animate-spin text-rose-500" size={32} />
        </div>
      }
    >
      <AdminLoginContent />
    </Suspense>
  );
}
ADMIN_LOGIN
ok "written"

# ═══════════════════════════════════════════════════════════════════════════════
# 2/4 — apps/web/app/login/page.tsx  (Split-screen premium)
# ═══════════════════════════════════════════════════════════════════════════════
h "2/4 — apps/web/app/login/page.tsx"
backup apps/web/app/login/page.tsx
cat > apps/web/app/login/page.tsx << 'WEB_LOGIN'
"use client";

import { useState, Suspense, useMemo } from "react";
import { loginAction } from "@/actions/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Loader2, Mail, Lock, ShieldCheck, AlertCircle,
  ArrowRight, Eye, EyeOff, Compass, Briefcase, Check, Flame,
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
      {/* Ambient background */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-purple-600/10 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-600/8 blur-[160px] rounded-full pointer-events-none" />

      {/* ─── Left brand panel ──────────────────────────────────────────── */}
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
              <p className="text-white font-black tracking-wider text-lg leading-none">
                ZEAL
              </p>
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
            <Flame size={12} /> 37+ metaphysical traditions
          </div>
          <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight">
            Connect with
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
              verified guides.
            </span>
          </h1>
          <p className="text-slate-400 text-base mt-6 leading-relaxed max-w-md">
            From Vedic astrology to licensed therapy — find the right expert in under 60 seconds.
          </p>

          <div className="mt-10 space-y-3.5">
            {[
              "Instant AI matching by intent",
              "Per-minute billing, no subscriptions",
              "Encrypted sessions with verified guides",
              "Realtime 24/7 AI astrologer backup",
            ].map((f, i) => (
              <motion.div
                key={f}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="flex items-center gap-3 text-sm text-slate-300"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                  <Check size={11} className="text-emerald-400" />
                </div>
                {f}
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex items-center gap-6 text-[11px] text-slate-600"
        >
          <span>© 2026 Zeal</span>
          <span>•</span>
          <span>SOC 2 Type II</span>
          <span>•</span>
          <span>GDPR Compliant</span>
        </motion.div>
      </div>

      {/* ─── Right form panel ──────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center">
                <Sparkles size={18} className="text-white" />
              </div>
              <span className="text-white font-black text-lg tracking-wider">ZEAL</span>
            </Link>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Sign in to continue to your dashboard
            </p>
          </div>

          {/* Error / success banners */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
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
                {phase === "verifying"
                  ? "Verifying your identity..."
                  : "Access granted — routing..."}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Google OAuth */}
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

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Email
              </label>
              <div className="relative group">
                <Mail
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors"
                />
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
              {touched.email && !emailValid && email.length > 0 && (
                <p className="mt-1.5 text-[11px] text-rose-400 flex items-center gap-1.5">
                  <AlertCircle size={11} /> Enter a valid email address
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[10px] text-purple-400 hover:text-purple-300 font-bold uppercase tracking-wider"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative group">
                <Lock
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors"
                />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-slate-300 transition-colors rounded-lg hover:bg-white/5"
                  tabIndex={-1}
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
                  Sign in <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-7 relative flex items-center justify-center">
            <div className="border-t border-white/5 w-full" />
            <span className="bg-slate-950 px-4 text-[10px] uppercase tracking-[0.25em] text-slate-600 font-bold">
              new here?
            </span>
            <div className="border-t border-white/5 w-full" />
          </div>

          {/* Role selectors */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/register"
              className="group p-4 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-purple-500/40 hover:bg-slate-900/90 transition-all text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Compass size={16} className="text-purple-400" />
              </div>
              <p className="text-white font-bold text-sm">Join as Seeker</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Explore & consult</p>
            </Link>

            <Link
              href="/register?type=consultant"
              className="group p-4 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-indigo-500/40 hover:bg-slate-900/90 transition-all text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Briefcase size={16} className="text-indigo-400" />
              </div>
              <p className="text-white font-bold text-sm">Apply as Guide</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Practice & earn</p>
            </Link>
          </div>

          {/* Admin link */}
          <p className="text-center text-[11px] text-slate-600 mt-6">
            Administrator?{" "}
            <a
              href="https://zeal-admin-rose.vercel.app/login"
              className="text-rose-400 hover:text-rose-300 font-bold"
            >
              Restricted access
            </a>
          </p>
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
WEB_LOGIN
ok "written"

# ═══════════════════════════════════════════════════════════════════════════════
# 3/4 — apps/web/app/register/page.tsx  (Multi-step premium)
# ═══════════════════════════════════════════════════════════════════════════════
h "3/4 — apps/web/app/register/page.tsx"
backup apps/web/app/register/page.tsx
cat > apps/web/app/register/page.tsx << 'WEB_REGISTER'
"use client";

import { useState, useMemo, useEffect } from "react";
import { registerAction } from "@/actions/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Loader2, Mail, Lock, User as UserIcon,
  Briefcase, ArrowRight, ShieldCheck, Compass,
  AlertCircle, Check, ChevronLeft, Eye, EyeOff, Flame,
} from "lucide-react";

type Role = "user" | "consultant";
type Strength = 0 | 1 | 2 | 3 | 4;

const STRENGTH_META: Record<Strength, { label: string; color: string; width: string }> = {
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
  const params = useSearchParams();

  const [role, setRole] = useState<Role>("user");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const s = useMemo(() => strength(password), [password]);
  const meta = STRENGTH_META[s];
  const passwordOk = password.length >= 12;
  const matches = password === confirm && confirm.length > 0;
  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);
  const nameValid = fullName.trim().length >= 2;

  useEffect(() => {
    const t = params.get("type");
    if (t === "consultant") setRole("consultant");
  }, [params]);

  const step1Valid = nameValid && emailValid;
  const step2Valid = passwordOk && matches;
  const canSubmit = step1Valid && step2Valid && agreed && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError("");

    const fd = new FormData();
    fd.append("fullName", fullName.trim());
    fd.append("email", email.trim().toLowerCase());
    fd.append("password", password);
    fd.append("accountType", role);

    const res = await registerAction(fd);

    if (res.success && res.destination) {
      router.push(res.destination);
    } else {
      setError(res.error || "Registration failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex relative overflow-hidden">
      <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/8 blur-[160px] rounded-full pointer-events-none" />

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
            <Flame size={12} /> Create your account
          </div>
          <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight">
            Begin your
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
              cosmic journey.
            </span>
          </h1>
          <p className="text-slate-400 text-base mt-6 leading-relaxed max-w-md">
            Join thousands of seekers connecting with verified consultants across 37+ traditions.
          </p>

          <div className="mt-10 space-y-3.5">
            {[
              "Free to join, pay only per consultation",
              "Verify consultants before you book",
              "End-to-end encrypted conversations",
              "Instant AI concierge for guidance",
            ].map((f, i) => (
              <motion.div
                key={f}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="flex items-center gap-3 text-sm text-slate-300"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                  <Check size={11} className="text-emerald-400" />
                </div>
                {f}
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex items-center gap-6 text-[11px] text-slate-600"
        >
          <span>© 2026 Zeal</span>
          <span>•</span>
          <span>SOC 2 Type II</span>
          <span>•</span>
          <span>GDPR Compliant</span>
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
          <div className="lg:hidden text-center mb-8">
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
              {role === "consultant"
                ? "Start your practice on Zeal"
                : "Begin your wellness journey"}
            </p>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2].map((n) => (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${
                  step >= n
                    ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25"
                    : "bg-slate-800 text-slate-500"
                }`}>
                  {step > n ? <Check size={12} /> : n}
                </div>
                {n < 2 && (
                  <div className={`flex-1 h-0.5 rounded-full transition-all duration-500 ${
                    step > n ? "bg-purple-500" : "bg-slate-800"
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Role toggle */}
          <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-white/5 mb-7">
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
              <Briefcase size={14} /> Guide / Advisor
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
                    <ShieldCheck size={14} /> Consultant Fast-Track
                  </div>
                  <p className="text-[11px] leading-relaxed text-indigo-300/80">
                    After account creation you'll be routed to a 3-step verification form.
                    Approval typically takes under 24 hours.
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

          {/* Google OAuth */}
          <div className="mb-6">
            <GoogleAuthButton
              label={role === "consultant" ? "Sign up with Google" : "Continue with Google"}
              redirectPath={role === "consultant" ? "/apply" : "/explore"}
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                      Full Name
                    </label>
                    <div className="relative group">
                      <UserIcon
                        size={17}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors"
                      />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Aacharya Sharma"
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
                      <Mail
                        size={17}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors"
                      />
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

                  <button
                    type="button"
                    disabled={!step1Valid}
                    onClick={() => setStep(2)}
                    className="btn-3d w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue <ArrowRight size={15} />
                  </button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                      Password
                    </label>
                    <div className="relative group">
                      <Lock
                        size={17}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors"
                      />
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
                          }`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium">
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
                      <Lock
                        size={17}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors"
                      />
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

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      disabled={loading}
                      className="px-5 py-4 bg-slate-900/60 hover:bg-slate-900 border border-white/5 rounded-2xl font-bold text-sm transition-all text-white disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <ChevronLeft size={15} /> Back
                    </button>
                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="btn-3d flex-1 py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        <>
                          Create account <ArrowRight size={15} />
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          <p className="text-center text-xs text-slate-500 mt-7">
            Already have an account?{" "}
            <Link href="/login" className="text-purple-400 hover:text-purple-300 font-bold">
              Sign in
            </Link>
          </p>
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
WEB_REGISTER
ok "written"

# ═══════════════════════════════════════════════════════════════════════════════
# 4/4 — apps/web/app/apply/page.tsx  (Consultant wizard + live preview)
# ═══════════════════════════════════════════════════════════════════════════════
h "4/4 — apps/web/app/apply/page.tsx"
backup apps/web/app/apply/page.tsx
cat > apps/web/app/apply/page.tsx << 'WEB_APPLY'
"use client";

import { useEffect, useState } from "react";
import { submitConsultantApplication, checkApplicationStatus } from "@/actions/consultant";
import {
  Sparkles, Send, Loader2, Clock, ShieldCheck, ArrowRight,
  Briefcase, Check, AlertCircle, Star, IndianRupee, Users,
  MessageCircle, Video, ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

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
    if (!bioOk) {
      setError("Bio must be at least 20 characters.");
      return;
    }
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

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    );
  }

  // ─── Pending state ───────────────────────────────────────────────────────
  if (status === "pending") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/30 rounded-[2.5rem] p-10 text-center shadow-2xl max-w-lg w-full"
        >
          <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock size={32} className="text-indigo-400" />
          </div>
          <h1 className="text-3xl font-black mb-3 text-white">Application Under Review</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Your profile has been transmitted. Our admin team will verify your credentials within 24 hours.
          </p>

          <div className="mt-7 p-5 rounded-2xl bg-slate-950/50 border border-white/5 text-left space-y-2.5">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Check size={11} className="text-emerald-400" />
              </div>
              Profile created
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Check size={11} className="text-emerald-400" />
              </div>
              Wallet initialized
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                <Clock size={11} />
              </div>
              Awaiting verification
            </div>
          </div>

          <Link
            href="/explore"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl mt-8 font-bold transition-all text-sm text-white"
          >
            Return to Explore
          </Link>
        </motion.div>
      </div>
    );
  }

  // ─── Verified state ──────────────────────────────────────────────────────
  if (status === "verified" || status === "approved") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-600/10 blur-[150px] rounded-full pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 bg-slate-900/80 backdrop-blur-2xl border border-emerald-500/30 rounded-[2.5rem] p-10 text-center shadow-2xl max-w-lg w-full"
        >
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-3xl font-black mb-3 text-white">You are a Consultant</h1>
          <p className="text-slate-400 text-sm">Your profile is verified and live on the platform.</p>

          <Link
            href="/consultant/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white rounded-2xl mt-8 font-bold transition-all text-sm shadow-xl shadow-emerald-500/20"
          >
            Enter Command Center <ArrowRight size={15} />
          </Link>
        </motion.div>
      </div>
    );
  }

  // ─── Wizard ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 relative z-10">
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-4">
            <Briefcase size={13} /> Consultant Application
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Join the Zeal network
          </h1>
          <p className="text-slate-400 text-sm mt-2 max-w-2xl">
            Complete the 3 steps below. Our team will verify your credentials within 24 hours.
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8 max-w-2xl">
          {[
            { n: 1, label: "Discipline" },
            { n: 2, label: "Rate" },
            { n: 3, label: "Bio" },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                step >= s.n
                  ? "bg-indigo-500/15 border border-indigo-500/30 text-indigo-300"
                  : "bg-slate-900/60 border border-white/5 text-slate-500"
              }`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                  step > s.n
                    ? "bg-indigo-500 text-white"
                    : step === s.n
                    ? "bg-indigo-500 text-white"
                    : "bg-slate-800 text-slate-500"
                }`}>
                  {step > s.n ? <Check size={10} /> : s.n}
                </div>
                {s.label}
              </div>
              {i < 2 && (
                <div className={`flex-1 h-0.5 rounded-full transition-all ${
                  step > s.n ? "bg-indigo-500" : "bg-slate-800"
                }`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ─── Left: form ──────────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
              {error && (
                <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-bold flex items-center gap-2.5">
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h2 className="text-xl font-black text-white mb-1">
                      Your primary discipline
                    </h2>
                    <p className="text-sm text-slate-400 mb-6">
                      Select the practice you specialize in.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                      {CATEGORIES.map((c) => {
                        const selected = expertise === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setExpertise(c.id)}
                            className={`relative p-5 rounded-2xl border-2 text-left transition-all ${
                              selected
                                ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_30px_-10px_rgba(99,102,241,0.5)]"
                                : "border-white/5 bg-slate-950 hover:border-white/20 hover:bg-slate-950/60"
                            }`}
                          >
                            {selected && (
                              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                                <Check size={11} className="text-white" />
                              </div>
                            )}
                            <div className="text-2xl mb-2">{c.icon}</div>
                            <h3 className="font-bold text-slate-100 text-sm mb-0.5">{c.id}</h3>
                            <p className="text-[11px] text-slate-500 leading-snug">{c.desc}</p>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={!expertise}
                      onClick={() => setStep(2)}
                      className="btn-3d w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      Continue <ArrowRight size={15} />
                    </button>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h2 className="text-xl font-black text-white mb-1">
                      Set your rate
                    </h2>
                    <p className="text-sm text-slate-400 mb-6">
                      Choose your per-minute consultation charge (₹10 – ₹500).
                    </p>

                    <div className="p-8 bg-slate-950/60 rounded-3xl border border-white/5 mb-6">
                      <div className="text-center mb-6">
                        <div className="flex items-center justify-center gap-2 text-white mb-2">
                          <IndianRupee className="w-7 h-7 text-emerald-400" />
                          <span className="text-5xl font-black font-mono">{rate}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                          per minute
                        </p>
                      </div>

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
                        <span>₹10</span>
                        <span>₹500</span>
                      </div>

                      <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">
                            Your cut (90%)
                          </p>
                          <p className="text-lg font-black font-mono text-emerald-400">
                            ₹{Math.round(rate * 0.9)}/min
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">
                            Platform fee (10%)
                          </p>
                          <p className="text-lg font-black font-mono text-slate-400">
                            ₹{Math.round(rate * 0.1)}/min
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="px-6 py-4 bg-slate-900/60 hover:bg-slate-900 border border-white/5 rounded-2xl font-bold text-sm transition-all text-white flex items-center gap-1.5"
                      >
                        <ChevronLeft size={15} /> Back
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="btn-3d flex-1 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2"
                      >
                        Continue <ArrowRight size={15} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.form
                    key="step3"
                    onSubmit={handleSubmit}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h2 className="text-xl font-black text-white mb-1">
                      Professional bio
                    </h2>
                    <p className="text-sm text-slate-400 mb-6">
                      Describe your lineage, certifications, and philosophy.
                    </p>

                    <textarea
                      required
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={8}
                      placeholder="I have practiced Vedic astrology for over 15 years, trained under..."
                      className={`w-full p-5 bg-slate-950 border rounded-2xl text-sm focus:border-indigo-500 outline-none text-slate-200 resize-none custom-scrollbar transition-colors ${
                        bio.length > 0 && !bioOk ? "border-rose-500/40" : "border-white/10"
                      }`}
                    />

                    <div className="flex items-center justify-between mt-2 mb-6 text-[11px]">
                      <span className={bioOk ? "text-emerald-400 font-medium" : "text-slate-500"}>
                        {bioOk
                          ? "✓ Bio meets minimum length"
                          : `Minimum 20 characters (${bio.trim().length}/20)`}
                      </span>
                      <span className="text-slate-600 font-mono">{bio.length}/1000</span>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        disabled={submitting}
                        className="px-6 py-4 bg-slate-900/60 hover:bg-slate-900 border border-white/5 rounded-2xl font-bold text-sm transition-all disabled:opacity-50 text-white flex items-center gap-1.5"
                      >
                        <ChevronLeft size={15} /> Back
                      </button>
                      <button
                        type="submit"
                        disabled={!bioOk || submitting}
                        className="btn-3d flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/20 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <><Loader2 size={17} className="animate-spin" /> Transmitting...</>
                        ) : (
                          <>Transmit Application <Send size={15} /></>
                        )}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ─── Right: live preview card ─────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                Live profile preview
              </p>

              <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 shadow-2xl">
                {/* Cover */}
                <div className="h-20 rounded-2xl bg-gradient-to-tr from-indigo-600/40 via-purple-600/30 to-indigo-600/40 -mx-1 -mt-1 mb-4 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(157,125,197,0.4),transparent_60%)]" />
                </div>

                {/* Avatar + name */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-4 border-slate-900 flex items-center justify-center text-white font-black text-lg -mt-8">
                    {bio.trim().charAt(0).toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-white text-sm truncate">
                      Your Name
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      @you · {expertise || "Discipline"}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 py-4 border-y border-white/5 mb-4">
                  <div className="text-center">
                    <p className="text-xs font-black text-white font-mono">0</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Sessions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black text-amber-400 flex items-center justify-center gap-0.5">
                      <Star size={10} className="fill-amber-400" /> 5.0
                    </p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Rating</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black text-indigo-400 font-mono">₹{rate}</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Per min</p>
                  </div>
                </div>

                {/* Bio preview */}
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-4 mb-4 min-h-[3rem]">
                  {bio.trim() || "Your bio will appear here as you type..."}
                </p>

                {/* Service chips */}
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {[
                    { Icon: MessageCircle, label: "Chat" },
                    { Icon: Video, label: "Video" },
                  ].map(({ Icon, label }) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-bold"
                    >
                      <Icon size={10} /> {label}
                    </span>
                  ))}
                </div>

                {/* CTA preview */}
                <button
                  disabled
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-xs opacity-60 cursor-not-allowed"
                >
                  Consult Now
                </button>

                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[9px] text-slate-600">
                  <span className="flex items-center gap-1">
                    <Users size={10} /> 0 clients
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck size={10} /> Pending
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-slate-600 text-center mt-3 leading-relaxed">
                This is how seekers will see your profile once verified.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
WEB_APPLY
ok "written"

# ═══════════════════════════════════════════════════════════════════════════════
# Verify + commit + push
# ═══════════════════════════════════════════════════════════════════════════════
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

info "Type-check admin..."
TA=$(npm run type-check --workspace=admin 2>&1 || true)
if echo "$TA" | grep -qE "error TS"; then
  warn "Admin errors:"
  echo "$TA" | grep "error TS" | head -10
  E=$((E+1))
else
  ok "admin passed"
fi

info "Staging + committing..."
git add -A
git reset -- _archive/ 2>/dev/null || true
git commit -m "Premium auth frontend: admin console, unified login, consultant wizard

- apps/admin/app/login/page.tsx: terminal-grade UI, live clock, node status,
  lockout countdown, fingerprint icon, restricted-access aesthetic
- apps/web/app/login/page.tsx: split-screen hero + form, password visibility,
  role selector cards, admin link, forgot-password link
- apps/web/app/register/page.tsx: 2-step progressive disclosure, real-time
  email/name validation, strength meter (weak/fair/good/strong), confirm
  password with match indicator, terms checkbox, role toggle
- apps/web/app/apply/page.tsx: 3-step wizard + live profile preview card
  on the right that updates as user fills in, category cards, rate slider
  with earnings breakdown, bio char counter

Style preserved: btn-3d, glass-card-3d, #9D7DC5/#533AFD, framer-motion" 2>&1 | tail -3

info "Pushing..."
git push origin main 2>&1 | tail -5

echo ""
if [[ $E -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║  DONE — 4 PREMIUM AUTH PAGES, PUSHED                           ║${NC}"
  echo -e "${GREEN}${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
else
  echo -e "${YELLOW}${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}${BOLD}║  DONE — ${E} TYPE ERROR(S), FIX BEFORE PUSHING                    ║${NC}"
  echo -e "${YELLOW}${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
fi

echo ""
echo "Test after Vercel deploy:"
echo "  https://zeal-admin-rose.vercel.app/login   (admin console)"
echo "  https://zeal-web-red.vercel.app/login      (unified)"
echo "  https://zeal-web-red.vercel.app/register   (multi-step)"
echo "  https://zeal-web-red.vercel.app/apply      (consultant wizard)"
echo ""

exit 0
ENDOFSCRIPT

chmod +x premium-auth-frontend.sh
bash premium-auth-frontend.sh