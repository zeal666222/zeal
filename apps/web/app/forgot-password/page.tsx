"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Check, Loader2, Mail, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field } from "@/components/auth/Field";
import { getBrowserSupabase } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const sb = getBrowserSupabase();
    if (!sb) {
      setError("Auth service unavailable. Try again in a moment.");
      return;
    }

    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: err } = await sb.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo },
      );
      if (err) {
        // Never leak whether the email exists.
        console.warn("[forgot-password]", err.message);
      }
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell
        mode="recovery"
        title="Check your inbox"
        subtitle="We sent a reset link if that account exists"
        brandIcon={ShieldCheck}
        footer={
          <p className="text-center text-xs text-slate-500">
            Back to{" "}
            <Link
              href="/login"
              className="text-purple-400 hover:text-purple-300 font-bold"
            >
              Sign in
            </Link>
          </p>
        }
      >
        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-start gap-3">
          <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />
          <div>
            <p className="font-bold">Reset link sent</p>
            <p className="text-emerald-300/80 text-xs mt-1">
              If an account exists for <strong>{email}</strong>, a reset link is
              on its way. Link expires in 60 minutes.
            </p>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      mode="recovery"
      title="Reset your password"
      subtitle="Enter your email and we'll send a reset link"
      brandIcon={ShieldCheck}
      footer={
        <p className="text-center text-xs text-slate-500">
          Remembered it?{" "}
          <Link
            href="/login"
            className="text-purple-400 hover:text-purple-300 font-bold"
          >
            Sign in
          </Link>
        </p>
      }
    >
      {error && (
        <div
          role="alert"
          className="mb-5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-start gap-2.5"
        >
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <Field
          name="email"
          type="email"
          label="Email"
          icon={Mail}
          autoComplete="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Sending…
            </>
          ) : (
            <>
              Send reset link <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
