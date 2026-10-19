"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle, ArrowRight, Briefcase, Check, Eye, EyeOff, Loader2, Lock, ShieldAlert,
} from "lucide-react";
import { ThemeToggle } from "@zeal/ui";
import { changeTemporaryPasswordAction } from "@/actions/admin/auth";

const RULES: { label: string; test: (pw: string) => boolean }[] = [
  { label: "At least 20 characters", test: (p) => p.length >= 20 },
  { label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One digit", test: (p) => /\d/.test(p) },
  { label: "One symbol", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export default function ChangeTemporaryPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const ruleState = useMemo(
    () => RULES.map((r) => ({ ...r, ok: r.test(password) })),
    [password],
  );
  const allRulesPass = ruleState.every((r) => r.ok);
  const matches = password.length > 0 && password === confirm;
  const canSubmit = allRulesPass && matches && !loading;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIssues([]);
    if (!canSubmit) return;
    setLoading(true);
    const fd = new FormData();
    fd.set("password", password);
    fd.set("confirm", confirm);
    const res = await changeTemporaryPasswordAction(fd);
    if (res.ok) {
      setDone(true);
      window.setTimeout(() => { window.location.href = "/admin/dashboard"; }, 1200);
      return;
    }
    setError(res.error);
    if (res.issues) setIssues(res.issues);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex relative overflow-hidden">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-indigo-500/10 blur-[160px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-purple-500/[0.08] blur-[160px] pointer-events-none" />

      <main className="flex-1 flex items-center justify-center p-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <Link href="/admin/login" className="inline-flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center">
              <Briefcase size={18} className="text-white" />
            </div>
            <span className="text-foreground font-black tracking-wider text-lg">
              ZEAL STUDIO
            </span>
          </Link>

          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <ShieldAlert size={18} className="text-amber-600 dark:text-amber-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-amber-700 dark:text-amber-300 text-xs font-bold">
                Temporary credential detected
              </p>
              <p className="text-amber-700/80 dark:text-amber-300/80 text-[11px] mt-1">
                This SUPER_ADMIN account was created with a bootstrap password.
                Choose a permanent one you control. Rotation is required before
                you can reach the console.
              </p>
            </div>
          </div>

          {done ? (
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-center">
              <Check size={28} className="mx-auto text-emerald-500 mb-3" />
              <p className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                Password rotated. Opening console…
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-black text-foreground tracking-tight">
                Change temporary password
              </h2>
              <p className="text-sm text-muted-foreground mt-1 mb-6">
                Minimum 20 characters with mixed case, a digit and a symbol.
              </p>

              {error && (
                <div
                  role="alert"
                  className="mb-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-xs font-medium flex items-start gap-2.5"
                >
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <div>
                    <p>{error}</p>
                    {issues.length > 0 && (
                      <ul className="mt-1.5 ml-4 list-disc text-[11px] opacity-90">
                        {issues.map((i) => <li key={i}>{i}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={submit} className="space-y-4" noValidate>
                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2"
                  >
                    New password
                  </label>
                  <div className="relative group">
                    <Lock
                      size={17}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-purple-400 transition-colors"
                    />
                    <input
                      id="new-password"
                      type={show ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••••••••••"
                      className="w-full pl-12 pr-12 py-3.5 bg-surface border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:bg-surface/90 focus:border-purple-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      tabIndex={-1}
                      aria-label={show ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-overlay transition-colors"
                    >
                      {show ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  <ul className="mt-3 space-y-1.5">
                    {ruleState.map((r) => (
                      <li
                        key={r.label}
                        className={
                          "flex items-center gap-2 text-[11px] " +
                          (r.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")
                        }
                      >
                        <span
                          className={
                            "w-4 h-4 rounded-full flex items-center justify-center border " +
                            (r.ok
                              ? "bg-emerald-500/15 border-emerald-500/30"
                              : "bg-surface border-border")
                          }
                        >
                          {r.ok ? <Check size={9} /> : <span className="w-1 h-1 rounded-full bg-muted-foreground" />}
                        </span>
                        {r.label}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2"
                  >
                    Confirm
                  </label>
                  <div className="relative group">
                    <Lock
                      size={17}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-purple-400 transition-colors"
                    />
                    <input
                      id="confirm-password"
                      type={show ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat new password"
                      className={
                        "w-full pl-12 pr-4 py-3.5 bg-surface border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors " +
                        (confirm.length > 0 && !matches
                          ? "border-rose-500/40 focus:border-rose-500"
                          : "border-border focus:bg-surface/90 focus:border-purple-500")
                      }
                    />
                  </div>
                  {confirm.length > 0 && !matches && (
                    <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-1.5 font-medium">
                      Passwords do not match
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Rotating…
                    </>
                  ) : (
                    <>
                      Rotate credential <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-[11px] text-muted-foreground mt-6">
                Stuck?{" "}
                <Link href="/admin/login" className="text-purple-500 hover:underline">
                  Sign out
                </Link>{" "}
                and re-run{" "}
                <code className="px-1.5 py-0.5 rounded bg-surface border border-border text-[10px]">
                  bootstrap-super-admin.mjs --force
                </code>
                .
              </p>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
