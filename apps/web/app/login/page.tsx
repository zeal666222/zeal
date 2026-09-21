"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field } from "@/components/auth/Field";
import { RealtimeStatus } from "@/components/auth/RealtimeStatus";
import { loginAction } from "@/actions/auth";
import { getBrowserSupabase } from "@/lib/supabase/client";

function friendlyAuthError(raw: string | null | undefined): string {
  if (!raw) return "Something went wrong. Please try again.";
  const s = raw.toLowerCase();
  if (s.includes("rate") || s.includes("too many") || s.includes("429"))
    return "Too many attempts. Please wait a minute and try again.";
  if (
    s.includes("invalid") ||
    s.includes("credential") ||
    s.includes("password")
  )
    return "Email or password is incorrect.";
  if (s.includes("unauthorized") || s.includes("401"))
    return "Please sign in again.";
  if (s.includes("network") || s.includes("fetch"))
    return "Connection hiccup. Check your internet and try again.";
  if (s.includes("not confirmed") || s.includes("confirm"))
    return "Please confirm your email first — check your inbox.";
  return "Sign-in failed. Please try again.";
}

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email],
  );
  const canSubmit = emailValid && password.length > 0 && !loading;

  useEffect(() => {
    const err = params.get("error");
    if (err === "not_authorized")
      setError("This account doesn't have access here.");
    else if (err === "handoff_failed")
      setError("Session transfer failed. Please sign in again.");
    else if (err) setError(friendlyAuthError(err));
  }, [params]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setError(null);
    if (!canSubmit) return;

    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await loginAction(fd);

      if (!res.ok) {
        setError(friendlyAuthError(res.error));
        setLoading(false);
        return;
      }

      // MFA probe — gate here if the account requires a second factor.
      const sb = getBrowserSupabase();
      if (sb) {
        try {
          const { data } =
            await sb.auth.mfa.getAuthenticatorAssuranceLevel();
          if (data?.nextLevel === "aal2" && data.currentLevel === "aal1") {
            setLoading(false);
            router.push("/mfa-challenge");
            return;
          }
        } catch {
          /* best-effort */
        }
      }

      setRedirecting(true);
      window.setTimeout(() => {
        router.push(res.destination);
        router.refresh();
      }, 450);
    } catch (err) {
      setError(
        friendlyAuthError(err instanceof Error ? err.message : "Login failed"),
      );
      setLoading(false);
    }
  };

  return (
    <AuthShell
      mode="login"
      title="Welcome back"
      subtitle="Sign in to continue your journey"
      brandIcon={ShieldCheck}
      features={[
        "Chat, voice, and video in one thread",
        "Realtime wallet + session billing",
        "Consultants vetted, seekers verified",
        "Encrypted, rate-limited, audited",
      ]}
      footer={
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            New to Zeal?{" "}
            <Link
              href="/register"
              className="text-purple-400 hover:text-purple-300 font-bold"
            >
              Create an account
            </Link>
          </span>
          <Link
            href="/forgot-password"
            className="hover:text-slate-300"
          >
            Forgot password?
          </Link>
        </div>
      }
      cta={
        <a
          href={
            process.env.NEXT_PUBLIC_ADMIN_URL ||
            "https://zeal-admin-rose.vercel.app"
          }
          className="block p-4 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-indigo-500/40 transition-all text-left group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-sm">
                Are you a consultant?
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Sign in to Zeal Studio
              </p>
            </div>
            <ArrowRight
              size={14}
              className="text-slate-500 group-hover:text-indigo-400 transition-colors"
            />
          </div>
        </a>
      }
    >
      <RealtimeStatus />

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="mb-5 overflow-hidden"
          >
            <div
              role="alert"
              className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-start gap-2.5"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field
          name="email"
          type="email"
          label="Email"
          icon={Mail}
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          error={
            touched.email && email.length > 0 && !emailValid
              ? "Please enter a valid email address"
              : null
          }
        />

        <Field
          name="password"
          label="Password"
          icon={Lock}
          autoComplete="current-password"
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          showToggle
        />

        <button
          type="submit"
          disabled={!canSubmit || redirecting}
          className="w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {redirecting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Signing in…
            </>
          ) : loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Verifying…
            </>
          ) : (
            <>
              Sign in <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>

      <p className="text-center text-[10px] text-slate-600 mt-6 flex items-center justify-center gap-1.5">
        <ShieldCheck size={10} /> Encrypted session · Rate-limited
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B0A14]" />}>
      <LoginContent />
    </Suspense>
  );
}
