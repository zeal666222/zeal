"use client";

import { useState } from "react";
import { signUpAction } from "@/actions/auth";
import { Sparkles, Mail, Lock, User, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const res = await signUpAction(formData);

    if (res.success) {
      // TypeScript Fix applied: Fallback strictly ensures a string value
      setMessage({ success: true, text: res.message || "Registration successful!" });
    } else {
      setMessage({ success: false, text: res.error || "Registration failed." });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900/85 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-4">
            <Sparkles size={14} /> Zeal Enterprise Auth
          </div>
          <h1 className="text-3xl font-black tracking-tight">Create Account</h1>
          <p className="text-slate-400 text-sm mt-1">Register to start your live consultation journey.</p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-2xl text-xs font-medium text-center border ${message.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-3.5 text-slate-400" />
              <input 
                name="fullName" 
                type="text" 
                required
                placeholder="Aarav Sharma" 
                className="w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-white/10 rounded-2xl text-sm focus:border-purple-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-3.5 text-slate-400" />
              <input 
                name="email" 
                type="email" 
                required
                placeholder="name@example.com" 
                className="w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-white/10 rounded-2xl text-sm focus:border-purple-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-3.5 text-slate-400" />
              <input 
                name="password" 
                type="password" 
                required
                placeholder="••••••••" 
                className="w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-white/10 rounded-2xl text-sm focus:border-purple-500 outline-none transition-all"
              />
            </div>
          </div>

          <input type="hidden" name="role" value="user" />

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-purple-600/30 hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            {loading ? "Registering..." : "Register Seeker Account"} <ArrowRight size={16} />
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          Already have an account? <Link href="/login" className="text-purple-400 font-bold hover:underline">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
