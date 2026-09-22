"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, ArrowRight, Briefcase, Check, Loader2, Lock, Mail, MailCheck,
  ShieldCheck, Sparkles, UserIcon,
} from "lucide-react";
import { ThemeToggle } from "@zeal/ui";
import { registerAction } from "@/actions/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";

const ADMIN_URL =
  process.env.NEXT_PUBLIC_ADMIN_URL || "https://zeal-admin-rose.vercel.app";

function friendlyRegisterError(raw: string | null | undefined): string {
  if (!raw) return "Something went wrong. Please try again.";
  const s = raw.toLowerCase();
  if (s.includes("already") || s.includes("exist"))
    return "An account with this email already exists. Try signing in.";
  if (s.includes("rate") || s.includes("too many") || s.includes("429"))
    return "Too many attempts. Please wait a minute.";
  if (s.includes("weak") || s.includes("password"))
    return "Password must be at least 12 characters.";
  if (s.includes("invalid") && s.includes("email"))
    return "Please enter a valid email address.";
  return "Registration failed. Please try again.";
}

function RegisterContent() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [touched, setTouched] = useState({ name: false, email: false, confirm: false });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const nameOk = fullName.trim().length >= 2;
  const emailOk = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email],
  );
  const pwOk = password.length >= 12;
  const matches = password === confirm && confirm.length > 0;
  const canSubmit = nameOk && emailOk && pwOk && matches && agreed && !loading;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setTouched({ name: true, email: true, confirm: true });
    if (!canSubmit) return;

    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await registerAction(fd);

      if (!res.ok) {
        setError(friendlyRegisterError(res.error));
        setLoading(false);
        return;
      }

      if ("needsConfirmation" in res && res.needsConfirmation) {
        setNeedsConfirm(true);
        setLoading(false);
        return;
      }

      if ("destination" in res && res.destination) {
        window.location.href = res.destination;
      }
    } catch (err) {
      setError(
        friendlyRegisterError(err instanceof Error ? err.message : "Register failed"),
      );
      setLoading(false);
    }
  };

  if (needsConfirm) {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center"
        >
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
            <MailCheck size={32} className="text-emerald-400" />
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
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0A14] flex relative overflow-hidden">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-indigo-500/10 blur-[160px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-purple-500/[0.08] blur-[160px] pointer-events-none" />

      <aside className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-14 border-r border-white/[0.06]">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-purple-500/20">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-black tracking-wider text-lg leading-none">
              ZEAL
            </p>
            <p className="text-[10px] text-slate-500 tracking-[0.2em] font-bold uppercase mt-0.5">
              Multi-Faith Wellness
            </p>
          </div>
        </Link>

        <div className="max-w-lg">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight"
          >
            Begin your
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
              journey.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-slate-400 text-base mt-6 max-w-md"
          >
            Connect with verified guides across every tradition — Vedic
            astrology, Islamic counseling, Buddhist meditation, Christian
            therapy, Tarot, energy healing, and modern wellness.
          </motion.p>

          <ul className="mt-10 space-y-3.5">
            {[
              "Instant access to verified guides",
              "Secure wallet with escrow protection",
              "Realtime chat, voice, and video",
              "Multi-faith — every path, one platform",
            ].map((f, i) => (
              <motion.li
                key={f}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.35 + i * 0.08 }}
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
          <span>© {new Date().getFullYear()} Zeal</span>
          <span>•</span>
          <span>SOC 2</span>
          <span>•</span>
          <span>GDPR</span>
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center p-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center">
                <Sparkles size={18} className="text-white" />
              </div>
              <span className="text-white font-black tracking-wider text-lg">ZEAL</span>
            </Link>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">
              Create your account
            </h2>
            <p className="text-sm text-slate-500 mt-1">Free to start · 60-second signup</p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="mb-5 overflow-hidden"
              >
                <div
                  role="alert"
                  className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-start gap-2.5"
                >
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="reg-name" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Full name
              </label>
              <div className="relative group">
                <UserIcon
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400"
                />
                <input
                  id="reg-name"
                  name="fullName"
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                  placeholder="Your full name"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none focus:bg-slate-900/90 focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Email
              </label>
              <div className="relative group">
                <Mail
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400"
                />
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="you@example.com"
                  className={
                    "w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none focus:bg-slate-900/90 transition-colors " +
                    (touched.email && email.length > 0 && !emailOk
                      ? "border-rose-500/40 focus:border-rose-500"
                      : "border-white/5 focus:border-purple-500")
                  }
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-pw" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Password
              </label>
              <div className="relative group">
                <Lock
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400"
                />
                <input
                  id="reg-pw"
                  name="password"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 12 characters"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none focus:bg-slate-900/90 focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-confirm" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Confirm password
              </label>
              <div className="relative group">
                <Lock
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400"
                />
                <input
                  id="reg-confirm"
                  name="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
                  placeholder="Repeat password"
                  className={
                    "w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none focus:bg-slate-900/90 transition-colors " +
                    (touched.confirm && confirm.length > 0 && !matches
                      ? "border-rose-500/40 focus:border-rose-500"
                      : "border-white/5 focus:border-purple-500")
                  }
                />
              </div>
              {matches && (
                <p className="text-[10px] text-emerald-400 mt-1.5 font-medium flex items-center gap-1">
                  <Check size={10} /> Passwords match
                </p>
              )}
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
                I agree to Zeal&apos;s{" "}
                <Link href="/terms" className="text-purple-400 hover:text-purple-300 font-bold">Terms</Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-purple-400 hover:text-purple-300 font-bold">Privacy Policy</Link>.
              </span>
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Creating account…</>
              ) : (
                <>Create account <ArrowRight size={15} /></>
              )}
            </button>
          </form>
          <div className="mt-6">
            <div className="relative my-6 flex items-center justify-center">
              <div className="border-t border-white/5 w-full" />
              <span className="bg-[#0B0A14] px-4 text-[10px] uppercase tracking-[0.25em] text-slate-600 font-bold">
                or
              </span>
              <div className="border-t border-white/5 w-full" />
            </div>
            <GoogleAuthButton
              label="Sign up with Google"
              redirectPath="/explore"
              intent="user"
            />
          </div>

          <p className="text-center text-xs text-slate-500 mt-7">
            Already have an account?{" "}
            <Link href="/login" className="text-purple-400 hover:text-purple-300 font-bold">
              Sign in
            </Link>
          </p>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-[11px] text-slate-500">Want to offer guidance?</p>
            <a
              href={`${ADMIN_URL}/register`}
              className="mt-3 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-indigo-500/40 text-sm font-bold text-white transition-all"
            >
              <Briefcase size={14} className="text-indigo-400" />
              Join as Consultant
            </a>
          </div>

          <p className="text-center text-[10px] text-slate-600 mt-6 flex items-center justify-center gap-1.5">
            <ShieldCheck size={10} /> Encrypted session · Rate-limited
          </p>
        </motion.div>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B0A14]" />}>
      <RegisterContent />
    </Suspense>
  );
}
