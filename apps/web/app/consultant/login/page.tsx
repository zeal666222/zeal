"use client";

import { useState, Suspense } from "react";
import { loginAction } from "@/actions/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Lock, Loader2, AlertCircle, Eye, EyeOff, ArrowRight, Compass,
} from "lucide-react";

function Content() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirectedFrom") || "/consultant/dashboard";

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailOk && password.length > 0 && !loading;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    fd.append("redirectTo", redirectTo);
    const res = await loginAction(fd);
    if (res.success && res.destination) {
      const dest = res.destination;
      if (dest === "/consultant/dashboard" || dest === "/admin") {
        router.push(dest);
      } else {
        setError("This account isn't registered as a consultant. Apply below or use the seeker sign-in.");
        setLoading(false);
      }
    } else {
      setError(res.error || "Sign-in failed.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-[#0B0A14]">
      <div className="absolute -top-40 left-0 w-[700px] h-[700px] rounded-full bg-indigo-500/10 blur-[180px] pointer-events-none" />
      <div className="absolute -bottom-40 right-0 w-[600px] h-[600px] rounded-full bg-emerald-500/6 blur-[180px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[420px]"
      >
        <div className="text-center mb-9">
          <Link href="/" className="inline-block mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
              <Compass size={22} className="text-indigo-300" strokeWidth={1.5} />
            </div>
          </Link>
          <h1 className="text-[28px] font-light text-white/95 tracking-tight">
            Consultant sign in
          </h1>
          <p className="text-[13px] text-white/40 mt-2 font-light">
            Access your practice dashboard
          </p>
        </div>

        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-2xl p-8 shadow-[0_20px_70px_-20px_rgba(0,0,0,0.8)]">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-6 p-3.5 rounded-2xl bg-rose-500/[0.08] border border-rose-400/20 text-rose-200 text-[12.5px] font-light flex items-start gap-2.5"
              >
                <AlertCircle size={15} className="mt-px shrink-0 opacity-80" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mb-5">
            <GoogleAuthButton
              label="Continue with Google"
              redirectPath="/consultant/dashboard"
              intent="consultant"
            />
          </div>

          <div className="relative flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/25 font-light">
              or
            </span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-medium text-white/50 tracking-wide mb-2">
                Consultant email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" strokeWidth={1.5} />
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@practice.com"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-[14px] text-white/90 placeholder:text-white/20 outline-none focus:border-indigo-400/40 focus:bg-white/[0.05] transition-all font-light"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-medium text-white/50 tracking-wide">
                  Password
                </label>
                <Link href="/forgot-password" className="text-[11px] text-indigo-300/70 hover:text-indigo-300 transition-colors font-light">
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" strokeWidth={1.5} />
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-[14px] text-white/90 placeholder:text-white/20 outline-none focus:border-indigo-400/40 focus:bg-white/[0.05] transition-all font-light"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all"
                >
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium text-[13.5px] tracking-wide transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 shadow-[0_10px_30px_-10px_rgba(99,102,241,0.5)]"
            >
              {loading ? (
                <><Loader2 size={15} className="animate-spin" /> Signing in…</>
              ) : (
                <>Sign in <ArrowRight size={15} /></>
              )}
            </button>
          </form>
        </div>

        <div className="mt-7 text-center space-y-2.5">
          <p className="text-[12px] text-white/40 font-light">
            New consultant?{" "}
            <Link href="/consultant/register" className="text-indigo-300/80 hover:text-indigo-300 transition-colors">
              Apply to practice on Zeal
            </Link>
          </p>
          <p className="text-[12px] text-white/40 font-light">
            Looking for a session?{" "}
            <Link href="/login" className="text-white/80 hover:text-white transition-colors">
              Seeker sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B0A14]" />}>
      <Content />
    </Suspense>
  );
}
