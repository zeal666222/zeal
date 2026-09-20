"use client";
// Magic link sign-in — no password required
import { useState } from "react";
import { createClient } from "@zeal/database";
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

export function MagicLinkForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/explore`,
          shouldCreateUser: false,
        },
      });
      if (err) throw err;
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send link");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
        <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-3" />
        <h3 className="text-white font-bold mb-1">Check your inbox</h3>
        <p className="text-sm text-slate-400">We sent a link to <strong className="text-white">{email}</strong>.</p>
        <button onClick={onBack} className="mt-5 text-xs text-purple-400 hover:text-purple-300 font-bold">
          ← Back to password sign-in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Email</label>
        <div className="relative group">
          <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400" />
          <input type="email" required autoComplete="email"
            value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none focus:bg-slate-900/90 focus:border-purple-500" />
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">{error}</div>}

      <button type="submit" disabled={loading || !email}
        className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 disabled:opacity-50">
        {loading ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : "Send magic link"}
      </button>

      <button type="button" onClick={onBack}
        className="w-full py-3 text-xs text-slate-500 hover:text-slate-300 flex items-center justify-center gap-1.5">
        <ArrowLeft size={12} /> Back to password
      </button>
    </form>
  );
}
