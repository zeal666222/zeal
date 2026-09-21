"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, ArrowRight, Briefcase, Check, Eye, EyeOff, Loader2, Lock, Mail,
  ShieldCheck, Sparkles,
} from "lucide-react";
import { ThemeToggle } from "@zeal/ui";
import { adminLoginAction } from "@/actions/auth";
import { PostAuthTransition } from "@/components/auth/PostAuthTransition";

type Destination = "studio" | "console";

const WEB_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://zeal-web-red.vercel.app";

function Content() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wrongPortal, setWrongPortal] = useState(false);
  const [transition, setTransition] = useState<Destination | null>(null);

  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email],
  );
  const canSubmit = emailValid && password.length > 0 && !loading;

  useEffect(() => {
    const err = params.get("error");
    if (err === "wrong_portal") {
      setError("This account belongs to the Zeal seeker app.");
      setWrongPortal(true);
    } else if (err === "not_authorized") {
      setError("This account doesn't have studio access.");
    } else if (err) {
      setError("Sign-in failed. Please try again.");
    }
  }, [params]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setError(null);
    setWrongPortal(false);
    if (!canSubmit) return;

    setLoading(true);
    const res = await adminLoginAction(new FormData(e.currentTarget));

    if (res.ok && res.destination) {
      const dest: Destination = res.destination.startsWith("/consultant")
        ? "studio"
        : "console";
      setTransition(dest);
      window.setTimeout(() => {
        router.push(res.destination);
        router.refresh();
      }, 950);
      return;
    }

    if (!res.ok) {
      setError(res.error);
      if (res.code === "WRONG_PORTAL_SEEKER") setWrongPortal(true);
    }
    setLoading(false);
  };

  return (
    <>
      <AnimatePresence>
        {transition && <PostAuthTransition destination={transition} email={email} />}
      </AnimatePresence>

      <div className="min-h-screen bg-[#0B0A14] flex relative overflow-hidden">
        {/* Theme toggle — top right */}
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>

        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-indigo-500/10 blur-[160px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-purple-500/[0.08] blur-[160px] pointer-events-none" />

        {/* LEFT: brand panel */}
        <aside className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-14 border-r border-white/[0.06]">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-purple-500/20">
              <Briefcase size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white font-black tracking-wider text-lg leading-none">
                ZEAL STUDIO
              </p>
              <p className="text-[10px] text-slate-500 tracking-[0.2em] font-bold uppercase mt-0.5">
                Consultant + Admin
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
              Your practice,
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
                always on.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-slate-400 text-base mt-6 max-w-md"
            >
              Multi-faith guidance across every tradition — Vedic, Islamic,
              Buddhist, Christian, Taoist, and beyond. Serve seekers in your own
              practice.
            </motion.p>

            <ul className="mt-10 space-y-3.5">
              {[
                "Live session queue with realtime billing",
                "Clients, schedule, and earnings — one dashboard",
                "Admin console with god-view metrics",
                "Realtime notifications across portals",
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

        {/* RIGHT: form */}
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
                  <Briefcase size={18} className="text-white" />
                </div>
                <span className="text-white font-black tracking-wider text-lg">
                  ZEAL STUDIO
                </span>
              </Link>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-black text-white tracking-tight">
                Welcome back
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Sign in to your consultant or admin account
              </p>
            </div>

            {wrongPortal && (
              <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-amber-300 text-xs font-bold mb-1">
                  This account belongs to Zeal
                </p>
                <p className="text-amber-300/80 text-[11px] mb-3">
                  You signed in as a seeker. Head to the Zeal app to continue.
                </p>
                <a
                  href={WEB_URL}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-bold"
                >
                  Open Zeal <ArrowRight size={11} />
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
              {/* Email */}
              <div>
                <label
                  htmlFor="admin-email"
                  className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2"
                >
                  Email
                </label>
                <div className="relative group">
                  <Mail
                    size={17}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors"
                  />
                  <input
                    id="admin-email"
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
                {touched.email && email.length > 0 && !emailValid && (
                  <p className="text-[10px] text-rose-400 mt-1.5 font-medium">
                    Please enter a valid email address
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="admin-password"
                    className="block text-[10px] font-black text-slate-500 uppercase tracking-widest"
                  >
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
                    id="admin-password"
                    name="password"
                    type={show ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                    placeholder="••••••••••••"
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none focus:bg-slate-900/90 focus:border-purple-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    tabIndex={-1}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors"
                  >
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Signing in…
                  </>
                ) : (
                  <>
                    Enter Studio <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            <div className="my-7 relative flex items-center justify-center">
              <div className="border-t border-white/5 w-full" />
              <span className="bg-[#0B0A14] px-4 text-[10px] uppercase tracking-[0.25em] text-slate-600 font-bold">
                new here?
              </span>
              <div className="border-t border-white/5 w-full" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/register"
                className="group p-4 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-indigo-500/40 hover:bg-slate-900/90 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Briefcase size={15} className="text-indigo-400" />
                </div>
                <p className="text-white font-bold text-sm">Join as Guide</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Practice & earn</p>
              </Link>

              <a
                href={WEB_URL}
                className="group p-4 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-purple-500/40 hover:bg-slate-900/90 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Sparkles size={15} className="text-purple-400" />
                </div>
                <p className="text-white font-bold text-sm">Looking for guidance?</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Join as Seeker</p>
              </a>
            </div>

            <p className="text-center text-[10px] text-slate-600 mt-6 flex items-center justify-center gap-1.5">
              <ShieldCheck size={10} /> Encrypted session · Rate-limited
            </p>
          </motion.div>
        </main>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B0A14]" />}>
      <Content />
    </Suspense>
  );
}
