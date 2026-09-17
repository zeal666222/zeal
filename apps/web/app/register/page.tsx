"use client";

import { useState, useMemo, useEffect } from "react";
import { registerAction } from "@/actions/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Loader2, Mail, Lock, User as UserIcon,
  Briefcase, ArrowRight, ShieldCheck, Compass,
  AlertCircle, Check, ChevronLeft, Eye, EyeOff, Flame,
} from "lucide-react";

type Role = "user" | "consultant";
type Strength = 0 | 1 | 2 | 3 | 4;

const STRENGTH_META: Record<Strength, { label: string; color: string; width: string }> = {
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

function RegisterContent() {
  const router = useRouter();
  const params = useSearchParams();

  const [role, setRole] = useState<Role>("user");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const s = useMemo(() => strength(password), [password]);
  const meta = STRENGTH_META[s];
  const passwordOk = password.length >= 12;
  const matches = password === confirm && confirm.length > 0;
  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);
  const nameValid = fullName.trim().length >= 2;

  useEffect(() => {
    const t = params.get("type");
    if (t === "consultant") setRole("consultant");
  }, [params]);

  const step1Valid = nameValid && emailValid;
  const step2Valid = passwordOk && matches;
  const canSubmit = step1Valid && step2Valid && agreed && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError("");

    const fd = new FormData();
    fd.append("fullName", fullName.trim());
    fd.append("email", email.trim().toLowerCase());
    fd.append("password", password);
    fd.append("accountType", role);

    const res = await registerAction(fd);

    if (res.success && res.destination) {
      router.push(res.destination);
    } else {
      setError(res.error || "Registration failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex relative overflow-hidden">
      <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/8 blur-[160px] rounded-full pointer-events-none" />

      {/* ─── Left panel ─────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-14 border-r border-white/5">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-purple-500/30 group-hover:scale-105 transition-transform">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white font-black tracking-wider text-lg leading-none">ZEAL</p>
              <p className="text-[10px] text-slate-500 tracking-[0.2em] font-bold uppercase mt-0.5">
                Wellness Universe
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
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-6">
            <Flame size={12} /> Create your account
          </div>
          <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight">
            Begin your
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
              cosmic journey.
            </span>
          </h1>
          <p className="text-slate-400 text-base mt-6 leading-relaxed max-w-md">
            Join thousands of seekers connecting with verified consultants across 37+ traditions.
          </p>

          <div className="mt-10 space-y-3.5">
            {[
              "Free to join, pay only per consultation",
              "Verify consultants before you book",
              "End-to-end encrypted conversations",
              "Instant AI concierge for guidance",
            ].map((f, i) => (
              <motion.div
                key={f}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="flex items-center gap-3 text-sm text-slate-300"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                  <Check size={11} className="text-emerald-400" />
                </div>
                {f}
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex items-center gap-6 text-[11px] text-slate-600"
        >
          <span>© 2026 Zeal</span>
          <span>•</span>
          <span>SOC 2 Type II</span>
          <span>•</span>
          <span>GDPR Compliant</span>
        </motion.div>
      </div>

      {/* ─── Right form panel ───────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center">
                <Sparkles size={18} className="text-white" />
              </div>
              <span className="text-white font-black text-lg tracking-wider">ZEAL</span>
            </Link>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">
              Create your account
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {role === "consultant"
                ? "Start your practice on Zeal"
                : "Begin your wellness journey"}
            </p>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2].map((n) => (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${
                  step >= n
                    ? "bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25"
                    : "bg-slate-800 text-slate-500"
                }`}>
                  {step > n ? <Check size={12} /> : n}
                </div>
                {n < 2 && (
                  <div className={`flex-1 h-0.5 rounded-full transition-all duration-500 ${
                    step > n ? "bg-purple-500" : "bg-slate-800"
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Role toggle */}
          <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-white/5 mb-7">
            <button
              type="button"
              onClick={() => setRole("user")}
              className={`py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                role === "user"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Compass size={14} /> Seeker
            </button>
            <button
              type="button"
              onClick={() => setRole("consultant")}
              className={`py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                role === "consultant"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Briefcase size={14} /> Guide / Advisor
            </button>
          </div>

          <AnimatePresence>
            {role === "consultant" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-6"
              >
                <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">
                  <div className="font-black flex items-center gap-2 text-indigo-200 mb-1.5">
                    <ShieldCheck size={14} /> Consultant Fast-Track
                  </div>
                  <p className="text-[11px] leading-relaxed text-indigo-300/80">
                    After account creation you'll be routed to a 3-step verification form.
                    Approval typically takes under 24 hours.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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

          {/* Google OAuth */}
          <div className="mb-6">
            <GoogleAuthButton
              label={role === "consultant" ? "Sign up with Google" : "Continue with Google"}
              redirectPath={role === "consultant" ? "/apply" : "/explore"}
              intent={role}
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
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                      Full Name
                    </label>
                    <div className="relative group">
                      <UserIcon
                        size={17}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors"
                      />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Aacharya Sharma"
                        autoComplete="name"
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                      Email
                    </label>
                    <div className="relative group">
                      <Mail
                        size={17}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors"
                      />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!step1Valid}
                    onClick={() => setStep(2)}
                    className="btn-3d w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue <ArrowRight size={15} />
                  </button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                      Password
                    </label>
                    <div className="relative group">
                      <Lock
                        size={17}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors"
                      />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={12}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 12 characters"
                        autoComplete="new-password"
                        className="w-full pl-12 pr-12 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-purple-500"
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
                          }`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium">
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
                      <Lock
                        size={17}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors"
                      />
                      <input
                        type="password"
                        required
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Repeat password"
                        autoComplete="new-password"
                        className={`w-full pl-12 pr-12 py-3.5 bg-slate-900/60 border rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:bg-slate-900/90 focus:border-purple-500 ${
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
                      I agree to Zeal's{" "}
                      <Link href="/terms" className="text-purple-400 hover:text-purple-300 font-bold">Terms</Link>
                      {" "}and{" "}
                      <Link href="/privacy" className="text-purple-400 hover:text-purple-300 font-bold">Privacy Policy</Link>.
                    </span>
                  </label>

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      disabled={loading}
                      className="px-5 py-4 bg-slate-900/60 hover:bg-slate-900 border border-white/5 rounded-2xl font-bold text-sm transition-all text-white disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <ChevronLeft size={15} /> Back
                    </button>
                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="btn-3d flex-1 py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        <>
                          Create account <ArrowRight size={15} />
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          <p className="text-center text-xs text-slate-500 mt-7">
            Already have an account?{" "}
            <Link href="/login" className="text-purple-400 hover:text-purple-300 font-bold">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="animate-spin text-purple-500" size={32} />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
