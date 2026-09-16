"use client";

import { useState } from "react";
import { registerAction } from "@/actions/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Sparkles, Loader2, Mail, Lock, User, 
  Briefcase, ArrowRight, ShieldCheck, CheckCircle2 
} from "lucide-react";

export default function RegisterPage() {
  const [accountType, setAccountType] = useState<"user" | "consultant">("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.append("accountType", accountType);

    const res = await registerAction(formData);

    if (res.success && res.destination) {
      router.push(res.destination);
    } else {
      setError(res.error || "Failed to create account.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen-app flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-indigo-600/15 blur-[160px] rounded-full pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-900/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative z-10">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black text-white tracking-tight">Join Project Zeal</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1.5">
            Select your account intent to get started.
          </p>
        </div>

        {/* 1. SEGMENTED ROLE TOGGLE */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-1.5 rounded-2xl border border-white/10 mb-6">
          <button
            type="button"
            onClick={() => setAccountType("user")}
            className={`py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
              accountType === "user"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 scale-[1.02]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Sparkles size={14} /> Seeker
          </button>
          <button
            type="button"
            onClick={() => setAccountType("consultant")}
            className={`py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
              accountType === "consultant"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-[1.02]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Briefcase size={14} /> Astrologer / Guide
          </button>
        </div>

        {/* Consultant Intent Notice */}
        {accountType === "consultant" && (
          <div className="mb-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs space-y-2 animate-in fade-in">
            <div className="font-bold flex items-center gap-1.5 text-indigo-200">
              <ShieldCheck size={16} /> Consultant Fast-Track
            </div>
            <p className="text-[11px] leading-relaxed text-indigo-300/90">
              Creating an astrologer account will immediately route you to the professional multi-step verification form.
            </p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold text-center">
            {error}
          </div>
        )}

        {/* 2. GOOGLE REGISTRATION BUTTON */}
        <div className="mb-6">
          <GoogleAuthButton
            label={accountType === "consultant" ? "Apply with Google" : "Sign up with Google"}
            redirectPath={accountType === "consultant" ? "/apply" : "/explore"}
            intent={accountType}
          />
        </div>

        <div className="relative flex items-center justify-center mb-6">
          <div className="border-t border-white/10 w-full" />
          <span className="bg-slate-900 px-3 text-[11px] uppercase tracking-widest text-slate-500 font-bold">
            Or register with email
          </span>
          <div className="border-t border-white/10 w-full" />
        </div>

        {/* 3. EMAIL/PASSWORD FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Full Legal Name
            </label>
            <div className="relative">
              <User size={16} className="absolute left-4 top-3.5 text-slate-500" />
              <input
                name="fullName"
                type="text"
                required
                placeholder="Aacharya Sharma"
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-sm focus:border-purple-500 text-white outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-3.5 text-slate-500" />
              <input
                name="email"
                type="email"
                required
                placeholder="name@domain.com"
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-sm focus:border-purple-500 text-white outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Create Secure Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-3.5 text-slate-500" />
              <input
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="Min. 6 characters"
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-sm focus:border-purple-500 text-white outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-3d w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-purple-600/20 transition-all flex items-center justify-center gap-2 mt-6 active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <span>{accountType === "consultant" ? "Continue to Application" : "Create Seeker Account"}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="mt-8 text-center border-t border-white/5 pt-6">
          <p className="text-slate-400 text-xs">
            Already have an account?{" "}
            <Link href="/login" className="text-purple-400 font-bold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
