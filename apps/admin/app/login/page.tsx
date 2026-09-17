"use client";

import { useState, useEffect, Suspense } from "react";
import { adminLoginAction } from "@/actions/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Mail, Loader2, AlertCircle, ShieldCheck, Eye, EyeOff } from "lucide-react";

function Content() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    if (params.get("error") === "unauthorized") {
      setError("This account doesn't have admin access.");
    }
  }, [params]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailOk && password.length > 0 && !loading;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    const res = await adminLoginAction(new FormData(e.currentTarget));
    if (res.success && res.destination) {
      router.push(res.destination);
    } else {
      setError(res.error || "Sign-in failed.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-[#0B0A14]">
      {/* soft ambient gradient */}
      <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-indigo-500/10 blur-[160px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-purple-500/8 blur-[160px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[420px]"
      >
        {/* Brand */}
        <div className="text-center mb-9">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] mb-5 backdrop-blur-sm">
            <ShieldCheck size={22} className="text-indigo-300" strokeWidth={1.5} />
          </div>
          <h1 className="text-[28px] font-light text-white/95 tracking-tight">
            Administrator access
          </h1>
          <p className="text-[13px] text-white/40 mt-2 font-light">
            Sign in to the Zeal management console
          </p>
        </div>

        {/* Card */}
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

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-medium text-white/50 tracking-wide mb-2">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25"
                  strokeWidth={1.5}
                />
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="admin@zeal.com"
                  className={`w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/[0.03] border text-[14px] text-white/90 placeholder:text-white/20 outline-none transition-all font-light ${
                    touched.email && !emailOk && email.length > 0
                      ? "border-rose-400/40"
                      : "border-white/[0.08] focus:border-indigo-400/40 focus:bg-white/[0.05]"
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-white/50 tracking-wide mb-2">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25"
                  strokeWidth={1.5}
                />
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
              className="w-full py-3.5 rounded-2xl bg-white text-[#0B0A14] font-medium text-[13.5px] tracking-wide transition-all hover:bg-white/90 active:scale-[0.99] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><Loader2 size={15} className="animate-spin" /> Signing in…</>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-white/25 mt-7 font-light">
          Not an administrator?{" "}
          <a
            href="https://zeal-web-red.vercel.app/login"
            className="text-white/50 hover:text-white/80 transition-colors"
          >
            Sign in as a user
          </a>
        </p>
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
