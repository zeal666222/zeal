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
