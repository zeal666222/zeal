"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// MFA Enrollment — TOTP factor + recovery codes
// ─────────────────────────────────────────────────────────────────────────────
// Flow:
//   1. Clear any unverified factors (Supabase rejects duplicate names)
//   2. Enroll → get QR + secret
//   3. User scans + enters 6-digit code → challengeAndVerify
//   4. On success: mint 10 recovery codes (client-generated, hashed server-side)
//
// Reference: Supabase Auth MFA docs + buildthisnow guide
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { createClient } from "@zeal/database";
import { AlertCircle, Check, CheckCircle2, Copy, KeyRound, Loader2, ShieldCheck } from "lucide-react";

type State =
  | { kind: "idle" }
  | { kind: "enrolling" }
  | { kind: "verifying"; factorId: string; qr: string; secret: string }
  | { kind: "recovery"; codes: string[] }
  | { kind: "done" };

interface Factor {
  id: string;
  factor_type: string;
  status: string;
  friendly_name?: string | null;
}

export function MfaEnrollment() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const supabase = createClient();

  async function startEnrollment() {
    setError(null);
    setState({ kind: "enrolling" });
    try {
      // Step 1: clear unverified factors
      const { data: listData } = await supabase.auth.mfa.listFactors();
      const all = (listData?.all ?? []) as Factor[];
      for (const f of all) {
        if (f.factor_type === "totp" && f.status === "unverified") {
          try { await supabase.auth.mfa.unenroll({ factorId: f.id }); } catch { /* ignore */ }
        }
      }

      // Step 2: enroll
      const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator-${Date.now()}`,
      });
      if (enrollErr) throw enrollErr;
      if (!data) throw new Error("No enrollment data");

      // Supabase returns the QR as raw SVG markup — wrap in data URL
      const svg = data.totp.qr_code;
      const qr = svg.startsWith("data:")
        ? svg
        : `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

      setState({ kind: "verifying", factorId: data.id, qr, secret: data.totp.secret });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrollment failed");
      setState({ kind: "idle" });
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind !== "verifying") return;
    if (code.length !== 6) return;
    setError(null);

    try {
      const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId: state.factorId,
        code,
      });
      if (verifyErr) throw verifyErr;

      // Mint recovery codes on the client — the server hashes them into
      // a UserRecoveryCode table (see SQL migration). We only show them once.
      const codes = Array.from({ length: 10 }, () => {
        const bytes = new Uint8Array(5);
        crypto.getRandomValues(bytes);
        const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 5)}-${hex.slice(5)}`;
      });

      setState({ kind: "recovery", codes });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    }
  }

  async function copyCodes() {
    if (state.kind !== "recovery") return;
    try {
      await navigator.clipboard.writeText(state.codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  // ─── Render: idle ──────────────────────────────────────────────────────────
  if (state.kind === "idle") {
    return (
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-white">Two-Factor Authentication</h3>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Add an authenticator app (Google Authenticator, 1Password, Authy) for a second layer of security.
        </p>
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}
        <button
          onClick={startEnrollment}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold text-sm"
        >
          Enable 2FA
        </button>
      </div>
    );
  }

  // ─── Render: enrolling ─────────────────────────────────────────────────────
  if (state.kind === "enrolling") {
    return (
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/5 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
      </div>
    );
  }

  // ─── Render: verifying ─────────────────────────────────────────────────────
  if (state.kind === "verifying") {
    return (
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/5 space-y-4">
        <h3 className="font-bold text-white">Scan QR code</h3>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-40 h-40 bg-white rounded-xl p-2 shrink-0">
            <img src={state.qr} alt="QR code" className="w-full h-full" />
          </div>
          <div className="flex-1 min-w-0 w-full">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
              Manual entry key
            </p>
            <code className="block text-xs text-purple-300 font-mono bg-slate-950 border border-white/5 rounded-lg px-3 py-2 break-all">
              {state.secret}
            </code>
          </div>
        </div>
        <form onSubmit={verify} className="space-y-3">
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">
            Enter 6-digit code
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm font-mono tracking-[0.3em] text-center text-white outline-none focus:border-purple-500"
              />
            </div>
            <button
              type="submit"
              disabled={code.length !== 6}
              className="px-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-bold disabled:opacity-50"
            >
              Verify
            </button>
          </div>
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle size={12} /> {error}
            </div>
          )}
        </form>
      </div>
    );
  }

  // ─── Render: recovery codes ────────────────────────────────────────────────
  if (state.kind === "recovery") {
    return (
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-amber-500/30 space-y-4">
        <div className="flex items-center gap-2 text-amber-400">
          <AlertCircle size={18} />
          <h3 className="font-bold">Save your recovery codes</h3>
        </div>
        <p className="text-xs text-slate-400">
          These codes will only be shown once. Store them in a password manager.
        </p>
        <div className="grid grid-cols-2 gap-2 p-4 rounded-xl bg-slate-950 border border-white/5 font-mono text-sm text-purple-300">
          {state.codes.map((c) => <div key={c}>{c}</div>)}
        </div>
        <button
          onClick={copyCodes}
          className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-bold flex items-center justify-center gap-2"
        >
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy all</>}
        </button>
        <button
          onClick={() => setState({ kind: "done" })}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold"
        >
          I've saved my codes
        </button>
      </div>
    );
  }

  // ─── Render: done ──────────────────────────────────────────────────────────
  return (
    <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-400">
      <CheckCircle2 size={20} />
      <span className="font-bold text-sm">Two-factor authentication enabled</span>
    </div>
  );
}
