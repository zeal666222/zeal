"use client";

import {Suspense, useState, useMemo} from "react";
import {useRouter} from "next/navigation";
import {motion, AnimatePresence} from "framer-motion";
import {AlertCircle, Briefcase, Loader2, Lock, Mail, Sparkles} from "lucide-react";
import {adminLoginAction} from "@/actions/auth";

function Content() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);
  const canSubmit = emailValid && password.length > 0 && !loading;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true); setError("");
    const res = await adminLoginAction(new FormData(e.currentTarget));
    if (res.success && res.destination) { router.push(res.destination); return; }
    setError(res.error || "Sign-in failed.");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-indigo-500/10 blur-[160px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-purple-500/8 blur-[160px] pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-[420px]">
        <div className="text-center mb-9">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 mb-5 shadow-2xl">
            <Briefcase size={22} className="text-white" />
          </div>
          <h1 className="text-[28px] font-light text-white/95 tracking-tight">Consultant / Admin access</h1>
          <p className="text-[13px] text-white/40 mt-2 font-light">Sign in to the Zeal Studio</p>
        </div>

        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-2xl p-8">
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mb-6 p-3.5 rounded-2xl bg-rose-500/[0.08] border border-rose-400/20 text-rose-200 text-[12.5px] flex items-start gap-2.5">
                <AlertCircle size={15} className="mt-px shrink-0 opacity-80" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-medium text-white/50 tracking-wide mb-2">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" />
                <input name="email" type="email" required autoComplete="email"
                  value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-[14px] text-white/90 placeholder:text-white/20 outline-none focus:border-indigo-400/40 font-light" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-white/50 tracking-wide mb-2">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25" />
                <input name="password" type="password" required autoComplete="current-password"
                  value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-[14px] text-white/90 placeholder:text-white/20 outline-none focus:border-indigo-400/40 font-light" />
              </div>
            </div>
            <button type="submit" disabled={!canSubmit}
              className="w-full py-3.5 rounded-2xl bg-white text-[#0B0A14] font-medium text-[13.5px] tracking-wide disabled:opacity-30 flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={15} className="animate-spin" /> Signing in…</> : "Sign in"}
            </button>
          </form>
        </div>

        <div className="mt-7 space-y-3 text-center">
          <p className="text-[11px] text-white/40 font-light">
            New consultant?{" "}
            <a href="/register" className="text-white/70 hover:text-white transition-colors">Create an account</a>
          </p>
          <p className="text-[11px] text-white/40 font-light">
            <Sparkles size={10} className="inline mr-1" />
            Looking for guidance?{" "}
            <a href={`${process.env.NEXT_PUBLIC_APP_URL}/register`} className="text-white/70 hover:text-white transition-colors">
              Join as a Seeker
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="min-h-screen bg-[#0B0A14]" />}><Content /></Suspense>;
}
