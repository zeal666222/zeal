"use client";

import { useState, Suspense } from "react";
import { registerAction } from "@/actions/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Lock, User as UserIcon, Loader2, AlertCircle, Eye, EyeOff,
  ArrowRight, Compass, Check,
} from "lucide-react";

function Content() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const router = useRouter();

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const nameOk = fullName.trim().length >= 2;
  const pwOk = password.length >= 12;
  const canSubmit = emailOk && nameOk && pwOk && !loading;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    fd.append("accountType", "consultant");
    const res = await registerAction(fd);
    if (res.success && res.destination) {
      router.push(res.destination);
    } else {
      setError(res.error || "Could not create your account.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-[#0B0A14]">
      <div className="absolute -top-40 right-0 w-[700px] h-[700px] rounded-full bg-indigo-500/10 blur-[180px] pointer-events-none" />
      <div className="absolute -bottom-40 left-0 w-[600px] h-[600px] rounded-full bg-emerald-500/6 blur-[180px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[440px]"
      >
        <div className="text-center mb-9">
          <Link href="/" className="inline-block mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
              <Compass size={22} className="text-indigo-300" strokeWidth={1.5} />
            </div>
          </Link>
          <h1 className="text-[28px] font-light text-white/95 tracking-tight">
            Apply to practice on Zeal
          </h1>
          <p className="text-[13px] text-white/40 mt-2 font-light">
            Create your account, then complete a short verification
          </p>
        </div>

        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-2xl p-8 shadow-[0_20px_70px_-20px_rgba(0,0,0,0.8)]">
          <div className="mb-6 p-4 rounded-2xl bg-indigo-500/[0.06] border border-indigo-400/15">
            <p className="text-[11.5px] text-indigo-200/85 font-light leading-relaxed">
              After account creation you'll be taken to a 3-step verification —
              discipline, rate, and bio. Approval typically takes under 24 hours.
            </p>
          </div>

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
              label="Sign up with Google"
              redirectPath="/apply"
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
                Legal name
              </label>
              <div className="relative">
                <UserIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" strokeWidth={1.5} />
                <input
                  name="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your professional name"
                  autoComplete="name"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-[14px] text-white/90 placeholder:text-white/20 outline-none focus:border-indigo-400/40 focus:bg-white/[0.05] transition-all font-light"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-white/50 tracking-wide mb-2">
                Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" strokeWidth={1.5} />
                <input
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@practice.com"
                  autoComplete="email"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-[14px] text-white/90 placeholder:text-white/20 outline-none focus:border-indigo-400/40 focus:bg-white/[0.05] transition-all font-light"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-white/50 tracking-wide mb-2">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" strokeWidth={1.5} />
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  required
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 12 characters"
                  autoComplete="new-password"
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
              {password.length > 0 && (
                <p className={`mt-2 text-[11px] font-light flex items-center gap-1.5 ${
                  pwOk ? "text-emerald-300/80" : "text-white/40"
                }`}>
                  {pwOk ? <><Check size={11} /> 12-character minimum met</> : `${12 - password.length} more character${12 - password.length === 1 ? "" : "s"}`}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium text-[13.5px] tracking-wide transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 shadow-[0_10px_30px_-10px_rgba(99,102,241,0.5)]"
            >
              {loading ? (
                <><Loader2 size={15} className="animate-spin" /> Creating account…</>
              ) : (
                <>Continue to application <ArrowRight size={15} /></>
              )}
            </button>

            <p className="text-[11px] text-white/30 text-center font-light leading-relaxed pt-1">
              By continuing you agree to our{" "}
              <Link href="/terms" className="text-white/60 hover:text-white/80">Terms</Link>
              {" "}and{" "}
              <Link href="/privacy" className="text-white/60 hover:text-white/80">Privacy Policy</Link>.
            </p>
          </form>
        </div>

        <div className="mt-7 text-center space-y-2.5">
          <p className="text-[12px] text-white/40 font-light">
            Already a consultant?{" "}
            <Link href="/consultant/login" className="text-indigo-300/80 hover:text-indigo-300 transition-colors">
              Sign in
            </Link>
          </p>
          <p className="text-[12px] text-white/40 font-light">
            Looking for a session?{" "}
            <Link href="/register" className="text-white/80 hover:text-white transition-colors">
              Seeker signup
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
