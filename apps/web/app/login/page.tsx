"use client";

import { useState } from "react";
import { loginAction } from "@/actions/auth";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Sparkles, Loader2, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectedFrom") || "/explore";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    formData.append("redirectTo", redirectTo);
    
    const res = await loginAction(formData);
    if (res?.success === false) {
      setError(res.error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen-app flex items-center justify-center p-4">
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative z-10">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
            <Sparkles className="text-purple-400" size={32} />
          </div>
        </div>
        
        <h1 className="text-3xl font-black text-center text-white mb-2 tracking-tight">Welcome Back</h1>
        <p className="text-center text-slate-400 text-sm mb-8">Enter your credentials to access your portal.</p>

        {error && <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-bold text-center">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <Mail size={18} className="absolute left-4 top-3.5 text-slate-500" />
            <input name="email" type="email" required placeholder="Email Address" className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:border-purple-500 text-white outline-none transition-colors" />
          </div>
          <div className="relative">
            <Lock size={18} className="absolute left-4 top-3.5 text-slate-500" />
            <input name="password" type="password" required placeholder="Password" className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:border-purple-500 text-white outline-none transition-colors" />
          </div>
          
          <button type="submit" disabled={loading} className="btn-3d w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 mt-4">
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Secure Login"}
          </button>
        </form>

        <p className="text-center text-slate-500 text-xs mt-8">
          Don't have an account? <Link href="/register" className="text-purple-400 font-bold hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}
