"use client";
// Forgot password — sends reset link via Supabase
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@zeal/database";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
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
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-purple-400 mb-8">
          <ArrowLeft size={14} /> Back to sign in
        </Link>

        {sent ? (
          <div className="p-8 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <CheckCircle2 size={44} className="mx-auto text-emerald-400 mb-4" />
            <h1 className="text-2xl font-black text-white mb-2">Check your inbox</h1>
            <p className="text-sm text-slate-400">
              If <strong className="text-white">{email}</strong> has an account, we sent a password reset link.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-black text-white mb-2">Reset your password</h1>
            <p className="text-sm text-slate-400 mb-8">
              Enter your email. We'll send you a link to set a new password.
            </p>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input type="email" required autoComplete="email"
                    value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none focus:border-purple-500" />
                </div>
              </div>

              {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">{error}</div>}

              <button type="submit" disabled={loading || !email}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : "Send reset link"}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
