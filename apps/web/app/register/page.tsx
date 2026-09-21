"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Loader2,
  Lock,
  Mail,
  MailCheck,
  ShieldCheck,
  UserIcon,
} from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field } from "@/components/auth/Field";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { registerAction } from "@/actions/auth";

function friendlyRegisterError(raw: string | null | undefined): string {
  if (!raw) return "Something went wrong. Please try again.";
  const s = raw.toLowerCase();
  if (s.includes("already") || s.includes("exist"))
    return "An account with this email already exists. Try signing in.";
  if (s.includes("rate") || s.includes("too many") || s.includes("429"))
    return "Too many attempts. Please wait a minute.";
  if (s.includes("weak") || s.includes("password"))
    return "Password must be at least 12 characters.";
  if (s.includes("invalid") && s.includes("email"))
    return "Please enter a valid email address.";
  if (s.includes("network") || s.includes("fetch"))
    return "Connection hiccup. Check your internet and try again.";
  return "Registration failed. Please try again.";
}

function RegisterContent() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    confirm: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const nameOk = fullName.trim().length >= 2;
  const emailOk = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email],
  );
  const pwOk = password.length >= 12;
  const matches = password === confirm && confirm.length > 0;
  const canSubmit = nameOk && emailOk && pwOk && matches && agreed && !loading;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setTouched({ name: true, email: true, confirm: true });
    if (!canSubmit) return;

    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await registerAction(fd);

      if (!res.ok) {
        setError(friendlyRegisterError(res.error));
        setLoading(false);
        return;
      }

      if ("needsConfirmation" in res && res.needsConfirmation) {
        setNeedsConfirm(true);
        setLoading(false);
        return;
      }

      if ("destination" in res && res.destination) {
        router.push(res.destination);
        router.refresh();
      }
    } catch (err) {
      setError(
        friendlyRegisterError(
          err instanceof Error ? err.message : "Register failed",
        ),
      );
      setLoading(false);
    }
  };

  if (needsConfirm) {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center"
        >
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
            <MailCheck size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">
            Check your inbox
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            We sent a confirmation link to{" "}
            <strong className="text-white">{email}</strong>. Click it, then come
            back and sign in.
          </p>
          <Link
            href="/login?registered=1"
            className="inline-flex items-center gap-2 mt-8 px-6 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-black text-sm"
          >
            Go to Sign In <ArrowRight size={15} />
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <AuthShell
      mode="register"
      title="Create your account"
      subtitle="Free to start · 60-second signup"
      brandIcon={ShieldCheck}
      features={[
        "Instant access to verified guides",
        "Secure wallet with escrow protection",
        "Realtime chat, voice, and video",
        "Encrypted, rate-limited, audited",
      ]}
      footer={
        <p className="text-center text-xs text-slate-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-purple-400 hover:text-purple-300 font-bold"
          >
            Sign in
          </Link>
        </p>
      }
      cta={
        <p className="text-center text-[10px] text-slate-600">
          Looking to practice?{" "}
          <a
            href={`${
              process.env.NEXT_PUBLIC_ADMIN_URL ||
              "https://zeal-admin-rose.vercel.app"
            }/register`}
            className="text-purple-400 hover:text-purple-300 font-bold"
          >
            Register as a consultant
          </a>
        </p>
      }
    >
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
          name="fullName"
          label="Full name"
          icon={UserIcon}
          autoComplete="name"
          placeholder="Your full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          error={
            touched.name && fullName.length > 0 && !nameOk
              ? "Name must be at least 2 characters"
              : null
          }
        />

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
            touched.email && email.length > 0 && !emailOk
              ? "Please enter a valid email address"
              : null
          }
        />

        <div>
          <Field
            name="password"
            label="Password"
            icon={Lock}
            autoComplete="new-password"
            placeholder="Min. 12 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            showToggle
          />
          <PasswordStrength value={password} />
        </div>

        <div>
          <Field
            name="confirmPassword"
            label="Confirm password"
            icon={Lock}
            autoComplete="new-password"
            placeholder="Repeat password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
            showToggle
            error={
              touched.confirm && confirm.length > 0 && !matches
                ? "Passwords don't match"
                : null
            }
          />
          {matches && (
            <p className="text-[10px] text-emerald-400 mt-1.5 font-medium flex items-center gap-1">
              <Check size={10} /> Passwords match
            </p>
          )}
        </div>

        <label className="flex items-start gap-3 cursor-pointer group py-2">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="peer sr-only"
            />
            <div className="w-5 h-5 rounded-md border-2 border-white/10 bg-slate-900/60 peer-checked:bg-purple-600 peer-checked:border-purple-600 transition-all flex items-center justify-center">
              {agreed && <Check size={12} className="text-white" />}
            </div>
          </div>
          <span className="text-[11px] text-slate-500 leading-relaxed">
            I agree to Zeal&apos;s{" "}
            <Link
              href="/terms"
              className="text-purple-400 hover:text-purple-300 font-bold"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="text-purple-400 hover:text-purple-300 font-bold"
            >
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Creating account…
            </>
          ) : (
            <>
              Create account <ArrowRight size={15} />
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

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B0A14]" />}>
      <RegisterContent />
    </Suspense>
  );
}
