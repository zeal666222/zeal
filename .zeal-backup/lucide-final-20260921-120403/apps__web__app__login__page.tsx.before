"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Enterprise Login
// ─────────────────────────────────────────────────────────────────────────────
// Features:
//   • Split layout — brand narrative left, form right
//   • Email + password with show/hide toggle
//   • Google OAuth + Magic Link alternatives
//   • Rate-limit awareness with friendly errors
//   • Handoff-aware (consultants/admins route cross-domain)
//   • Redirect to intended destination after sign-in
// ═══════════════════════════════════════════════════════════════════════════════

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, ArrowRight, Briefcase, Check, Compass, Eye, EyeOff,
  Loader2, Lock, Mail, Sparkles, Wand2,
} from "lucide-react";
import { loginAction, type LoginResult } from "@/actions/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { MagicLinkForm } from "@/components/auth/MagicLinkForm";

const ERROR_COPY: Record<string, string> = {
  INVALID_CREDENTIALS: "Email or password is incorrect.",
  RATE_LIMITED: "Too many attempts. Please wait a minute.",
  INTERNAL: "Something went wrong. Please try again.",
  NOT_AUTHORIZED: "This account doesn't have access.",
};

function Content() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirectedFrom") ?? "";

  const [loading, setLoading] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const [magicMode, setMagicMode] = useState(false);

  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email],
  );
  const canSubmit = emailValid && password.length > 0 && !loading;

  useEffect(() => {
    const errParam = params.get("error");
    if (errParam === "handoff_failed") {
      setError("Session handoff failed. Please sign in again.");
    } else if (errParam === "not_authorized") {
      setError("That account doesn't have access to this portal.");
    }
  }, [params]);

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
        setHandoff(true);
        window.location.href = res.destination;
        return;
      }
      router.push(res.destination);
      return;
    }
    setError(ERROR_COPY[res.code] ?? res.error);
    setLoading(false);
  };

  if (handoff) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="max-w-md text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center mb-6">
            <Briefcase size={32} className="text-indigo-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Opening Consultant Studio…</h1>
          <p className="text-slate-400 text-sm">Transferring your session to the admin portal.</p>
          <Loader2 size={20} className="mx-auto mt-6 animate-spin text-indigo-400" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-purple-600/10 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-600/8 blur-[160px] rounded-full pointer-events-none" />

      {/* Left: brand panel */}
      <aside className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-14 border-r border-white/5">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-black tracking-wider text-lg leading-none">ZEAL</p>
            <p className="text-[10px] text-slate-500 tracking-[0.2em] font-bold uppercase mt-0.5">Wellness Universe</p>
          </div>
        </Link>

        <div className="max-w-lg">
          <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight">
            Sign in to
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
              your universe.
            </span>
          </h1>
          <p className="text-slate-400 text-base mt-6 max-w-md">
            Seekers stay here. Consultants & admins are auto-routed to the studio.
          </p>
          <ul className="mt-10 space-y-3.5">
            {[
              "Seeker → explore 37+ traditions",
              "Consultant → auto-handoff to studio",
              "Admin → god-view console",
              "Realtime notifications across portals",
            ].map((f, i) => (
              <motion.li key={f} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="flex items-center gap-3 text-sm text-slate-300">
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

      {/* Right: form */}
      <main className="flex-1 flex items-center justify-center p-6 relative">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">Welcome back</h2>
            <p className="text-sm text-slate-500 mt-1">
              {magicMode ? "We'll email you a magic link" : "Sign in with email"}
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mb-5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-start gap-2.5">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {magicMode ? (
            <MagicLinkForm onBack={() => setMagicMode(false)} />
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Email</label>
                <div className="relative group">
                  <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400" />
                  <input name="email" type="email" required autoComplete="email"
                    value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    onBlur={() => setTouched(true)} placeholder="you@example.com"
                    className={`w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none focus:bg-slate-900/90 focus:border-purple-500 ${
                      touched && !emailValid && email.length > 0 ? "border-rose-500/40" : "border-white/5"
                    }`} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Password</label>
                  <Link href="/forgot-password" className="text-[10px] text-slate-500 hover:text-purple-400">
                    Forgot?
                  </Link>
                </div>
                <div className="relative group">
                  <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400" />
                  <input name="password" type={show ? "text" : "password"} required autoComplete="current-password"
                    value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none focus:bg-slate-900/90 focus:border-purple-500" />
                  <button type="button" onClick={() => setShow((v) => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-slate-300">
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={!canSubmit}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : <>Sign in <ArrowRight size={15} /></>}
              </button>
            </form>
          )}

          {!magicMode && (
            <>
              <div className="my-7 relative flex items-center justify-center">
                <div className="border-t border-white/5 w-full" />
                <span className="bg-slate-950 px-4 text-[10px] uppercase tracking-[0.25em] text-slate-600 font-bold">or</span>
                <div className="border-t border-white/5 w-full" />
              </div>

              <div className="space-y-3">
                <GoogleAuthButton label="Continue with Google" redirectPath="/explore" intent="user" />
                <button type="button" onClick={() => setMagicMode(true)}
                  className="w-full py-3.5 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-purple-500/40 text-slate-300 text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                  <Wand2 size={15} /> Magic link
                </button>
              </div>
            </>
          )}

          <div className="my-7 relative flex items-center justify-center">
            <div className="border-t border-white/5 w-full" />
            <span className="bg-slate-950 px-4 text-[10px] uppercase tracking-[0.25em] text-slate-600 font-bold">new here?</span>
            <div className="border-t border-white/5 w-full" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link href="/register" className="group p-4 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-purple-500/40 transition-all">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center mb-3">
                <Compass size={16} className="text-purple-400" />
              </div>
              <p className="text-white font-bold text-sm">Join as Seeker</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Explore & consult</p>
            </Link>
            <a href={`${process.env.NEXT_PUBLIC_ADMIN_URL}/register`}
              className="group p-4 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-indigo-500/40 transition-all">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center mb-3">
                <Briefcase size={16} className="text-indigo-400" />
              </div>
              <p className="text-white font-bold text-sm">Join as Guide</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Practice & earn</p>
            </a>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-950" />}><Content /></Suspense>;
}
