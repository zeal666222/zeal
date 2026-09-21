"use client";
// Reset password — new password + confirm
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@zeal/database";
import { Check, Eye, EyeOff, Loader2, Lock } from "lucide-react";

type Strength = 0 | 1 | 2 | 3 | 4;
const META: Record<Strength, { label: string; color: string; width: string }> = {
  0: { label: "",       color: "",                  width: "0%" },
  1: { label: "Weak",   color: "bg-rose-500",       width: "25%" },
  2: { label: "Fair",   color: "bg-amber-500",      width: "50%" },
  3: { label: "Good",   color: "bg-blue-500",       width: "75%" },
  4: { label: "Strong", color: "bg-emerald-500",    width: "100%" },
};

function score(pw: string): Strength {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 12) s++;
  if (pw.length >= 16) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4) as Strength;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = useMemo(() => score(pw), [pw]);
  const meta = META[strength];
  const pwOk = pw.length >= 12;
  const match = pw === confirm && confirm.length > 0;
  const canSubmit = pwOk && match && !loading;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password: pw });
      if (err) throw err;
      router.push("/login?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <h1 className="text-3xl font-black text-white mb-2">Set a new password</h1>
        <p className="text-sm text-slate-400 mb-8">Choose a strong password with at least 12 characters.</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
              New password
            </label>
            <div className="relative">
              <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
              <input type={show ? "text" : "password"} required minLength={12}
                value={pw} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPw(e.target.value)}
                placeholder="Min. 12 characters"
                className="w-full pl-12 pr-12 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none focus:border-purple-500" />
              <button type="button" onClick={() => setShow((v) => !v)} tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-slate-300">
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {pw.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div animate={{ width: meta.width }} className={`h-full ${meta.color}`} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{meta.label}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
              Confirm password
            </label>
            <div className="relative">
              <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
              <input type="password" required
                value={confirm} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                className={`w-full pl-12 pr-12 py-3.5 bg-slate-900/60 border rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none focus:border-purple-500 ${
                  confirm.length > 0 && !match ? "border-rose-500/40" : "border-white/5"
                }`} />
              {match && (
                <Check size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400" />
              )}
            </div>
          </div>

          {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">{error}</div>}

          <button type="submit" disabled={!canSubmit}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Updating…</> : "Update password"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
