"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, ArrowRight, Loader2, Lock, Mail, ShieldCheck, Sparkles,
  Briefcase,
} from "lucide-react";
import { ThemeToggle } from "@zeal/ui";
import { loginAction } from "@/actions/auth";

const ADMIN_URL =
  process.env.NEXT_PUBLIC_ADMIN_URL || "https://zeal-admin-rose.vercel.app";

function friendlyAuthError(raw: string | null | undefined): string {
  if (!raw) return "Something went wrong. Please try again.";
  const s = raw.toLowerCase();
  if (s.includes("rate") || s.includes("too many") || s.includes("429"))
    return "Too many attempts. Please wait a minute and try again.";
  if (s.includes("invalid") || s.includes("credential") || s.includes("password"))
    return "Email or password is incorrect.";
  if (s.includes("unauthorized") || s.includes("401"))
    return "Please sign in again.";
  if (s.includes("network") || s.includes("fetch"))
    return "Connection hiccup. Check your internet and try again.";
  return "Sign-in failed. Please try again.";
}

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wrongPortal, setWrongPortal] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email],
  );
  const canSubmit = emailValid && password.length > 0 && !loading;

  useEffect(() => {
    const err = params.get("error");
    if (err === "wrong_portal") {
      setError("This account belongs to Zeal Studio.");
      setWrongPortal(true);
    } else if (err === "not_authorized") {
      setError("This account doesn't have access here.");
    } else if (err) {
      setError(friendlyAuthError(err));
    }
  }, [params]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setError(null);
    setWrongPortal(false);
    if (!canSubmit) return;

    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await loginAction(fd);

      if (!res.ok) {
        setError(friendlyAuthError(res.error));
        if (res.code === "WRONG_PORTAL_CONSULTANT") setWrongPortal(true);
        setLoading(false);
        return;
      }

      setRedirecting(true);
      window.setTimeout(() => {
        router.push(res.destination);
        router.refresh();
      }, 450);
    } catch (err) {
      setError(
        friendlyAuthError(err instanceof Error ? err.message : "Login failed"),
      );
      setLoading(false);
    }
  };

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
            Every tradition.
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
              One platform.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-slate-400 text-base mt-6 max-w-md"
          >
            Vedic astrology · Islamic counseling · Buddhist meditation ·
            Christian therapy · Taoist wellness · Tarot · Energy healing ·
            and modern coaching — all in one place.
          </motion.p>
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
              <span className="text-white font-black tracking-wider text-lg">
                ZEAL
              </span>
            </Link>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Sign in to continue your journey
            </p>
          </div>

          {wrongPortal && (
            <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-amber-300 text-xs font-bold mb-1">
                This account belongs to Zeal Studio
              </p>
              <p className="text-amber-300/80 text-[11px] mb-3">
                You signed in as a consultant. Head to the studio to continue.
              </p>
              <a
                href={ADMIN_URL}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-bold"
              >
                Open Zeal Studio <ArrowRight size={11} />
              </a>
            </div>
          )}

          <AnimatePresence>
            {error && !wrongPortal && (
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
              <label htmlFor="login-email" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Email
              </label>
              <div className="relative group">
                <Mail
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors"
                />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="you@example.com"
                  className={
                    "w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-colors " +
                    (touched.email && email.length > 0 && !emailValid
                      ? "border-rose-500/40 focus:border-rose-500"
                      : "border-white/5 focus:bg-slate-900/90 focus:border-purple-500")
                  }
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="login-password" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[10px] text-slate-500 hover:text-purple-400 transition-colors"
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
                  id="login-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  placeholder="••••••••••••"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none focus:bg-slate-900/90 focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit || redirecting}
              className="w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {redirecting ? (
                <><Loader2 size={16} className="animate-spin" /> Signing in…</>
              ) : loading ? (
                <><Loader2 size={16} className="animate-spin" /> Verifying…</>
              ) : (
                <>Sign in <ArrowRight size={15} /></>
              )}
            </button>
          </form>

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

          <p className="text-center text-xs text-slate-500 mt-6">
            New to Zeal?{" "}
            <Link href="/register" className="text-purple-400 hover:text-purple-300 font-bold">
              Create an account
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B0A14]" />}>
      <LoginContent />
    </Suspense>
  );
}
