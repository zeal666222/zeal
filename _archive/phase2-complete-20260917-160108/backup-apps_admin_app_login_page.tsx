"use client";

import { useState } from "react";
import { adminLoginAction } from "@/actions/auth";
import { useRouter } from "next/navigation";
import { ShieldAlert, Lock, Mail, Loader2, Server } from "lucide-react";

export default function AdminLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const res = await adminLoginAction(formData);

    if (res.success && res.destination) {
      router.push(res.destination);
    } else {
      setError(res.error || "Authentication failed.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-600/10 blur-[150px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-md bg-zinc-950/80 backdrop-blur-2xl border border-white/5 rounded-3xl p-10 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Server className="text-rose-500" size={32} />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-widest">Zeal Core</h1>
          <p className="text-zinc-500 text-xs mt-2 uppercase tracking-wider font-bold">Restricted Access Node</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold text-center flex items-center justify-center gap-2">
            <ShieldAlert size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative group">
            <Mail size={16} className="absolute left-4 top-4 text-zinc-600 group-focus-within:text-rose-500 transition-colors" />
            <input name="email" type="email" required placeholder="admin@zeal.com" className="w-full pl-12 pr-4 py-3.5 bg-zinc-900/50 border border-white/5 rounded-xl text-sm focus:border-rose-500 text-white outline-none transition-all" />
          </div>
          <div className="relative group">
            <Lock size={16} className="absolute left-4 top-4 text-zinc-600 group-focus-within:text-rose-500 transition-colors" />
            <input name="password" type="password" required placeholder="••••••••" className="w-full pl-12 pr-4 py-3.5 bg-zinc-900/50 border border-white/5 rounded-xl text-sm focus:border-rose-500 text-white outline-none transition-all" />
          </div>

          <button type="submit" disabled={loading} className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 mt-6 active:scale-95 disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Authorize"}
          </button>
        </form>
      </div>
    </div>
  );
}
