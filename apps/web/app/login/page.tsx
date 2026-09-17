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
