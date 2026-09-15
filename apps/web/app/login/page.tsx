"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { ShieldCheck, Mail, Lock, User, Briefcase } from "lucide-react";

export default function LoginPage() {
  const [tab, setTab] = useState<"seeker" | "partner">("seeker");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState("/dashboard");

  useEffect(() => {
    // Capture intended destination from URL parameters (e.g., ?redirect=/consultant/acharya-rajesh)
    const params = new URLSearchParams(window.location.search);
    const dest = params.get("redirect");
    if (dest) {
      setRedirectUrl(dest);
    }
  }, []);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  const handleAuth = async (e: React.FormEvent, type: "login" | "signup") => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = type === "login" 
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ 
          email, 
          password,
          options: { data: { role: tab === "partner" ? "consultant" : "user" } } 
        });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      // Intelligently redirect back to the exact card or page the user wanted
      window.location.href = redirectUrl;
    }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${redirectUrl}` }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 shadow-2xl">
        
        <div className="flex p-1 bg-slate-100 dark:bg-slate-950/50 rounded-2xl mb-8">
          <button 
            onClick={() => setTab("seeker")}
            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${tab === 'seeker' ? 'bg-white dark:bg-slate-800 shadow-sm text-purple-600' : 'text-slate-500'}`}
          >
            <User size={16} /> Seeker
          </button>
          <button 
            onClick={() => setTab("partner")}
            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${tab === 'partner' ? 'bg-white dark:bg-slate-800 shadow-sm text-emerald-600' : 'text-slate-500'}`}
          >
            <Briefcase size={16} /> Partner
          </button>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">
            {tab === "seeker" ? "Enter the Network" : "Master Portal"}
          </h1>
          <p className="text-slate-500 text-sm flex items-center justify-center gap-1">
            <ShieldCheck size={14} className="text-emerald-500" /> Secure Authentication
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-2xl text-sm text-center">
            {error}
          </div>
        )}

        <form className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-4 text-slate-400" size={20} />
            <input type="email" placeholder="Email address" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl outline-none focus:border-purple-500 text-sm" />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
            <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl outline-none focus:border-purple-500 text-sm" />
          </div>

          <div className="flex gap-4 pt-4">
            <button onClick={(e) => handleAuth(e, "login")} disabled={loading} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-2xl font-bold hover:bg-purple-600 transition-colors cursor-pointer">
              Sign In
            </button>
            <button onClick={(e) => handleAuth(e, "signup")} disabled={loading} className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
              Register
            </button>
          </div>
        </form>

        <div className="mt-6">
          <button onClick={handleGoogleLogin} className="w-full py-3.5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer">
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
