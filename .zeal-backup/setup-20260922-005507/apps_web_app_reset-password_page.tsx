"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Check, Loader2, Lock, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field } from "@/components/auth/Field";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { getBrowserSupabase } from "@/lib/supabase/client";

function ResetContent() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  const pwOk = password.length >= 12;
  const matches = password === confirm && confirm.length > 0;
  const canSubmit = pwOk && matches && !loading;

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setError("Auth service unavailable.");
      return;
    }
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    sb.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;
    const sb = getBrowserSupabase();
    if (!sb) {
      setError("Auth service unavailable.");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await sb.auth.updateUser({ password });
      if (err) {
        setError(err.message || "Could not update password");
        return;
      }
      setDone(true);
      window.setTimeout(() => {
        router.push("/login?reset=1");
        router.refresh();
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthShell
        mode="recovery"
        title="Password updated"
        subtitle="You can now sign in with your new password"
        brandIcon={ShieldCheck}
      >
        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-start gap-3">
          <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />
          <p>Redirecting to sign in…</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      mode="recovery"
      title="Set a new password"
      subtitle="Choose something strong and memorable"
      brandIcon={ShieldCheck}
      footer={
        <p className="text-center text-xs text-slate-500">
          <Link
            href="/login"
            className="text-purple-400 hover:text-purple-300 font-bold"
          >
            Back to sign in
          </Link>
        </p>
      }
    >
      {!ready && !error && (
        <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
          Verifying reset link…
        </div>
      )}

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
        <div>
          <Field
            name="password"
            label="New password"
            icon={Lock}
            autoComplete="new-password"
            placeholder="Min. 12 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            showToggle
          />
          <PasswordStrength value={password} />
        </div>

        <Field
          name="confirmPassword"
          label="Confirm new password"
          icon={Lock}
          autoComplete="new-password"
          placeholder="Repeat password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          showToggle
          error={confirm.length > 0 && !matches ? "Passwords don't match" : null}
        />

        <button
          type="submit"
          disabled={!canSubmit || !ready}
          className="w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Updating…
            </>
          ) : (
            <>
              Update password <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B0A14]" />}>
      <ResetContent />
    </Suspense>
  );
}
