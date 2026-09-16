"use client";

import { useState } from "react";
import { loginAction } from "@/actions/auth";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Loader2, Mail, Lock, ArrowRight, Shield } from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [redirectMessage, setRedirectMessage] = useState("");
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectedFrom") || "/explore";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setRedirectMessage("");

    const formData = new FormData(e.currentTarget);
    formData.append("redirectTo", redirectTo);

    const res = await loginAction(formData);

    if (res.success && res.destination) {
      setRedirectMessage("Identity verified. Loading portal...");
      router.push(res.destination);
    } else {
      setError(res.error || "Authentication failed.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen-app flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/15 blur-[160px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative z-10">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 border border-purple-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <Sparkles className="text-purple-400" size={30} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Access Portal</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1.5">
            Single gateway for Seekers, Guides, and Administrators.
          </p>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold text-center animate-in fade-in">
            {error}
          </div>
        )}
        {redirectMessage && (
          <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold text-center animate-pulse flex items-center justify-center gap-2">
            <Shield size={16} /> {redirectMessage}
          </div>
        )}

        {/* 1. GOOGLE OAUTH */}
        <div className="mb-6">
          <GoogleAuthButton
            label="Continue with Google"
            redirectPath={redirectTo}
            intent="user"
          />
        </div>

        <div className="relative flex items-center justify-center mb-6">
          <div className="border-t border-white/10 w-full" />
          <span className="bg-slate-900 px-3 text-[11px] uppercase tracking-widest text-slate-500 font-bold">
            Or with email
          </span>
          <div className="border-t border-white/10 w-full" />
        </div>

        {/* 2. CREDENTIALS FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-3.5 text-slate-500" />
              <input
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-sm focus:border-purple-500 text-white outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-3d w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-purple-600/20 transition-all flex items-center justify-center gap-2 mt-6 active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <span>Sign In to Zeal</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="mt-8 text-center border-t border-white/5 pt-6">
          <p className="text-slate-400 text-xs">
            New to the platform?{" "}
            <Link href="/register" className="text-purple-400 font-bold hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
