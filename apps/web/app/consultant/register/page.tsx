"use client";

import { useState, useMemo } from "react";
import { registerAction } from "@/actions/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Briefcase, Loader2, Mail, Lock, User as UserIcon,
  ArrowRight, AlertCircle, Check, Eye, EyeOff, Sparkles,
  IndianRupee, Users, Activity, BarChart3, Star, ShieldCheck,
} from "lucide-react";

type Strength = 0 | 1 | 2 | 3 | 4;
const META: Record<Strength, { label: string; color: string; width: string }> = {
  0: { label: "", color: "", width: "0%" },
  1: { label: "Weak", color: "bg-rose-500", width: "20%" },
  2: { label: "Fair", color: "bg-amber-500", width: "45%" },
  3: { label: "Good", color: "bg-blue-500", width: "70%" },
  4: { label: "Strong", color: "bg-emerald-500", width: "100%" },
};

function strength(pw: string): Strength {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 12) s++;
  if (pw.length >= 16) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4) as Strength;
}

export default function ConsultantRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const s = useMemo(() => strength(password), [password]);
  const meta = META[s];
  const passwordOk = password.length >= 12;
  const matches = password === confirm && confirm.length > 0;
  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);
  const nameValid = fullName.trim().length >= 2;
  const canSubmit = nameValid && emailValid && passwordOk && matches && agreed && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");

    const fd = new FormData();
    fd.append("fullName", fullName.trim());
    fd.append("email", email.trim().toLowerCase());
    fd.append("password", password);
    fd.append("accountType", "consultant");  // → routes to /apply

    const res = await registerAction(fd);

    if (res.success && res.destination) {
      router.push(res.destination);
    } else {
      setError(res.error || "Registration failed.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex relative overflow-hidden">
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-indigo-600/10 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-emerald-600/6 blur-[160px] rounded-full pointer-events-none" />

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
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-6">
            <Sparkles size={12} /> Join the network
          </div>
          <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight">
            Launch your
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
              practice.
            </span>
          </h1>
          <p className="text-slate-400 text-base mt-6 leading-relaxed max-w-md">
            Register in under a minute. Complete a 3-step verification, then start earning.
          </p>

          <div className="mt-10 space-y-3.5">
            {[
              { icon: IndianRupee, text: "Keep 90% of every session" },
              { icon: Users, text: "Client CRM + booking history" },
              { icon: Activity, text: "Real-time seeker requests" },
              { icon: BarChart3, text: "Live earnings dashboard" },
              { icon: Star, text: "Reviews that build your reputation" },
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

          <div className="mt-10 p-4 rounded-2xl bg-slate-900/60 border border-white/5">
            <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-black uppercase tracking-widest mb-2">
              <ShieldCheck size={11} /> Application Flow
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="text-white font-bold">1. Create account</span>
              <ArrowRight size={11} className="text-slate-600" />
              <span className="text-white font-bold">2. Verify discipline</span>
              <ArrowRight size={11} className="text-slate-600" />
              <span className="text-white font-bold">3. Go live</span>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="flex items-center gap-6 text-[11px] text-slate-600">
          <span>© 2026 Zeal</span>
          <span>•</span>
          <span>90% revenue share</span>
          <span>•</span>
          <span>No monthly fee</span>
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

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-3">
              <Briefcase size={11} /> Consultant
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Create consultant account
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Free to apply — no monthly fees
            </p>
          </div>

          <div className="mb-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">
            <div className="font-black flex items-center gap-2 text-indigo-200 mb-1.5">
              <ShieldCheck size={14} /> Fast-track onboarding
            </div>
            <p className="text-[11px] leading-relaxed text-indigo-300/80">
              After account creation you'll be routed to a 3-step verification form.
              Approval typically takes under 24 hours.
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-start gap-2.5"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <div className="mb-6">
            <GoogleAuthButton
              label="Sign up with Google"
              redirectPath="/apply"
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
                Legal Name
              </label>
              <div className="relative group">
                <UserIcon size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Aacharya Sharma"
                  autoComplete="name"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Email
              </label>
              <div className="relative group">
                <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@practice.com"
                  autoComplete="email"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Password
              </label>
              <div className="relative group">
                <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 12 characters"
                  autoComplete="new-password"
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

              {password.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        animate={{ width: meta.width }}
                        transition={{ duration: 0.4 }}
                        className={`h-full ${meta.color} rounded-full`}
                      />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      s <= 1 ? "text-rose-400" :
                      s === 2 ? "text-amber-400" :
                      s === 3 ? "text-blue-400" : "text-emerald-400"
                    }`}>{meta.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {passwordOk
                      ? "✓ Meets 12-character minimum"
                      : `${12 - password.length} more character${12 - password.length === 1 ? "" : "s"} required`}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Confirm Password
              </label>
              <div className="relative group">
                <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  className={`w-full pl-12 pr-12 py-3.5 bg-slate-900/60 border rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-indigo-500 ${
                    confirm.length > 0 && !matches ? "border-rose-500/40" : "border-white/5"
                  }`}
                />
                {matches && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <Check size={12} className="text-emerald-400" />
                  </div>
                )}
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer py-2">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-5 h-5 rounded-md border-2 border-white/10 bg-slate-900/60 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all flex items-center justify-center">
                  {agreed && <Check size={12} className="text-white" />}
                </div>
              </div>
              <span className="text-[11px] text-slate-500 leading-relaxed">
                I agree to Zeal's{" "}
                <Link href="/terms" className="text-indigo-400 hover:text-indigo-300 font-bold">Terms</Link>
                {" "}and{" "}
                <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300 font-bold">Privacy Policy</Link>.
              </span>
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-3d w-full py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Creating account...</>
              ) : (
                <>Continue to Application <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <div className="mt-7 pt-6 border-t border-white/5 text-center space-y-3">
            <p className="text-xs text-slate-500">
              Already a consultant?{" "}
              <Link href="/consultant/login" className="text-indigo-400 hover:text-indigo-300 font-bold">
                Sign in
              </Link>
            </p>
            <p className="text-[11px] text-slate-600">
              Looking for a session?{" "}
              <Link href="/register" className="text-purple-400 hover:text-purple-300 font-bold">
                Seeker signup
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
