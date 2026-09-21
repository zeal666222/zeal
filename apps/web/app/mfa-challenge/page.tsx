"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field } from "@/components/auth/Field";
import { getBrowserSupabase } from "@/lib/supabase/client";

export default function MFAChallengePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const sb = getBrowserSupabase();
    if (!sb) {
      setError("Auth service unavailable.");
      return;
    }
    setLoading(true);
    try {
      const { data: factors } = await sb.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (!totp) {
        setError("No MFA factor enrolled for this account.");
        return;
      }
      const { data: challenge, error: cErr } = await sb.auth.mfa.challenge({
        factorId: totp.id,
      });
      if (cErr || !challenge) {
        setError(cErr?.message || "Could not start challenge");
        return;
      }
      const { error: vErr } = await sb.auth.mfa.verify({
        factorId: totp.id,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (vErr) {
        setError("Invalid code. Please try again.");
        return;
      }
      router.push("/explore");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      mode="mfa"
      title="Two-factor verification"
      subtitle="Enter the 6-digit code from your authenticator app"
      brandIcon={ShieldCheck}
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
          name="code"
          label="Verification code"
          placeholder="123456"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Verifying…
            </>
          ) : (
            <>
              Verify <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
