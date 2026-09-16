"use client";

import { useState } from "react";
import { registerAction } from "@/actions/auth";
import Link from "next/link";
import { Sparkles, Loader2, Mail, Lock, User } from "lucide-react";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await registerAction(new FormData(e.currentTarget));
    if (res?.success === false) {
      setError(res.error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen-app flex items-center justify-center p-4">
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative z-10">
        <h1 className="text-3xl font-black text-center text-white mb-2 tracking-tight">Join Zeal</h1>
        <p className="text-center text-slate-400 text-sm mb-8">Create your account to seek guidance.</p>

        {error && <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-bold text-center">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <User size={18} className="absolute left-4 top-3.5 text-slate-500" />
            <input name="fullName" type="text" required placeholder="Full Name" className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:border-indigo-500 text-white outline-none transition-colors" />
          </div>
          <div className="relative">
            <Mail size={18} className="absolute left-4 top-3.5 text-slate-500" />
            <input name="email" type="email" required placeholder="Email Address" className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:border-indigo-500 text-white outline-none transition-colors" />
          </div>
          <div className="relative">
            <Lock size={18} className="absolute left-4 top-3.5 text-slate-500" />
            <input name="password" type="password" required placeholder="Create Password" minLength={6} className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:border-indigo-500 text-white outline-none transition-colors" />
          </div>
          
          <button type="submit" disabled={loading} className="btn-3d w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 mt-4">
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Create Account"}
          </button>
        </form>

        <p className="text-center text-slate-500 text-xs mt-8">
          Already have an account? <Link href="/login" className="text-indigo-400 font-bold hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
