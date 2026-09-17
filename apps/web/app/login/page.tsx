"use client";

import { useState, Suspense, useMemo } from "react";
import { loginAction } from "@/actions/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles, Loader2, Mail, Lock, ShieldCheck, AlertCircle, Briefcase, ArrowRight,
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
  const [phase, setPhase] = useState<"idle" | "verifying" | "redirecting">("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectedFrom") || "/explore";

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);
  const formValid = emailValid && password.length > 0;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!formValid) return;

    setLoading(true);
    setPhase("verifying");
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.append("redirectTo", redirectTo);

    const res = await loginAction(formData);

    if (res.success && res.destination) {
      setPhase("redirecting");
      router.push(res.destination);
    } else {
      setError(friendlyError(res.error || ""));
      setLoading(false);
      setPhase("idle");
    }
  };

  const isConsultantPath = redirectTo.startsWith("/consultant");

  return (
    <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative z-10">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 border border-purple-500/30 rounded-[1.25rem] flex items-center justify-center mx-auto mb-5 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-white/5" />
          <Sparkles className="text-purple-400 relative z-10" size={32} />
        </div>
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 tracking-tight">
          Command Center
        </h1>
        <p className="text-slate-400 text-sm mt-2 font-medium">
          {isConsultantPath ? "Consultant access" : "Unified access for Seekers & Guides"}
        </p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold text-center flex items-center justify-center gap-2"
        >
          <AlertCircle size={14} /> {error}
        </motion.div>
      )}

      {phase !== "idle" && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold text-center flex items-center justify-center gap-2"
        >
          <ShieldCheck size={14} />
          {phase === "verifying" ? "Verifying identity..." : "Redirecting to your dashboard..."}
        </motion.div>
      )}

      <div className="mb-6">
        <GoogleAuthButton
          label="Sign in with Google"
          redirectPath={redirectTo}
          intent={isConsultantPath ? "consultant" : "user"}
        />
      </div>

      <div className="relative flex items-center justify-center mb-6">
        <div className="border-t border-white/10 w-full" />
        <span className="bg-slate-900 px-4 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Or</span>
        <div className="border-t border-white/10 w-full" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Email Address
          </label>
          <div className="relative group">
            <Mail size={18} className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              placeholder="you@example.com"
              className={`w-full pl-12 pr-4 py-3.5 bg-slate-950/50 border rounded-2xl text-sm focus:border-purple-500 focus:bg-slate-950 text-white outline-none transition-all shadow-inner ${
                touched.email && !emailValid ? "border-rose-500/50" : "border-white/10"
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
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Secure Password
          </label>
          <div className="relative group">
            <Lock size={18} className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              placeholder="••••••••"
              className="w-full pl-12 pr-4 py-3.5 bg-slate-950/50 border border-white/10 rounded-2xl text-sm focus:border-purple-500 focus:bg-slate-950 text-white outline-none transition-all shadow-inner"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !formValid}
          className="btn-3d w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 mt-8 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> {phase === "redirecting" ? "Redirecting..." : "Authenticating..."}</>
          ) : (
            <><ShieldCheck size={16} /> Authenticate Session</>
          )}
        </button>
      </form>

      <div className="mt-8 text-center pt-6 border-t border-white/5">
        <p className="text-slate-400 text-xs font-medium">
          Don't have an account?{" "}
          <Link href="/register" className="text-purple-400 font-bold hover:text-purple-300 transition-colors">
            Create one now
          </Link>
        </p>
        <p className="text-slate-500 text-[11px] font-medium mt-3">
          Consultant access is available after approval.{" "}
          <Link href="/apply" className="text-purple-400 font-bold hover:text-purple-300 transition-colors">
            Apply here
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen-app flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-600/15 blur-[160px] rounded-full pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none mix-blend-screen" />
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center relative z-10">
            <Loader2 className="animate-spin text-purple-500 mb-4" size={32} />
            <p className="text-slate-400 font-bold animate-pulse text-sm">Initializing Secure Gateway...</p>
          </div>
        }
      >
        <LoginContent />
      </Suspense>
    </div>
  );
}
