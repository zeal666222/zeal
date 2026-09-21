#!/usr/bin/env bash
# =============================================================================
# fix-auth.sh — Enterprise auth rewrite for Zeal (web + admin)
# Safe to run with zero env vars. Backs up before overwriting.
# =============================================================================
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

c_grn(){ printf '\033[32m✓\033[0m %s\n' "$*"; }
c_ylw(){ printf '\033[33m!\033[0m %s\n' "$*"; }
c_red(){ printf '\033[31m✗\033[0m %s\n' "$*"; }
c_dim(){ printf '\033[2m%s\033[0m\n'  "$*"; }
hr(){    printf '\n──────── %s ────────\n' "$*"; }

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR=".backup/auth-rewrite-$TS"

backup(){
  local p="$1"; [[ -f "$p" ]] || return 0
  mkdir -p "$BACKUP_DIR/$(dirname "$p")"
  cp "$p" "$BACKUP_DIR/$p"
}

write(){
  local path="$1"
  backup "$path"
  mkdir -p "$(dirname "$path")"
  cat > "$path"
  c_grn "wrote $path"
}

hr "ZEAL — ENTERPRISE AUTH REWRITE"
c_dim "repo:   $ROOT"
c_dim "backup: $BACKUP_DIR"
c_dim "mode:   no-keys-required"

# ═════════════════════════════════════════════════════════════════════════════
# 1. env helper (null-safe — never throws at import)
# ═════════════════════════════════════════════════════════════════════════════
write apps/web/lib/env.ts <<'EOF'
// Centralized, null-safe env access. Never throws at import time.
// Missing env is tolerated in dev; the app degrades gracefully.

export const env = {
  supabaseUrl:      (process.env.NEXT_PUBLIC_SUPABASE_URL      ?? "").trim(),
  supabaseAnonKey:  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
  appUrl:           (process.env.NEXT_PUBLIC_APP_URL   ?? "").replace(/\/$/, ""),
  adminUrl:         (process.env.NEXT_PUBLIC_ADMIN_URL ?? "").replace(/\/$/, ""),
  isDev:            process.env.NODE_ENV !== "production",
  isProd:           process.env.NODE_ENV === "production",
} as const;

export function hasSupabaseEnv(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
EOF

# ═════════════════════════════════════════════════════════════════════════════
# 2. browser supabase client (lazy, returns null when env missing)
# ═════════════════════════════════════════════════════════════════════════════
write apps/web/lib/supabase/client.ts <<'EOF'
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env, hasSupabaseEnv } from "@/lib/env";

let _client: SupabaseClient | null = null;

/** Returns a cached browser client, or `null` when env is unavailable. */
export function getBrowserSupabase(): SupabaseClient | null {
  if (_client) return _client;
  if (!hasSupabaseEnv()) {
    if (env.isDev) {
      console.warn(
        "[supabase] env missing — auth & realtime disabled in this dev session.",
      );
    }
    return null;
  }
  _client = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  return _client;
}
EOF

# ═════════════════════════════════════════════════════════════════════════════
# 3. auth provider (env-safe, exposes isConfigured)
# ═════════════════════════════════════════════════════════════════════════════
write apps/web/components/providers/SupabaseAuthProvider.tsx <<'EOF'
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isLoading: true,
  isConfigured: false,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function SupabaseAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .catch((err: unknown) => {
        console.warn("[auth] getSession failed:", err);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, next: Session | null) => {
        if (!mounted) return;
        setSession(next);
        setUser(next?.user ?? null);
        setIsLoading(false);
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value: AuthContextValue = useMemo(
    () => ({
      user,
      session,
      isLoading,
      isConfigured: Boolean(supabase),
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
      },
    }),
    [user, session, isLoading, supabase],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
EOF

# ═════════════════════════════════════════════════════════════════════════════
# 4. shared auth UI — shell, field, password strength, realtime badge
# ═════════════════════════════════════════════════════════════════════════════
write apps/web/components/auth/AuthShell.tsx <<'EOF'
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Sparkles, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface AuthShellProps {
  mode: "login" | "register" | "recovery" | "mfa";
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  cta?: ReactNode;
  brandIcon?: LucideIcon;
  brandTitle?: string;
  features?: string[];
}

const COPY: Record<AuthShellProps["mode"], { headline: [string, string]; tagline: string }> = {
  login: {
    headline: ["Your practice,", "always on."],
    tagline:
      "Sessions, earnings, and seekers — everything in one calm, realtime console.",
  },
  register: {
    headline: ["Begin your", "journey."],
    tagline:
      "Instant activation. No approval queue. Complete your profile to go live.",
  },
  recovery: {
    headline: ["Recover", "your access."],
    tagline: "We'll help you get back in without a hitch.",
  },
  mfa: {
    headline: ["One more", "step."],
    tagline: "Confirm it's really you.",
  },
};

export function AuthShell({
  mode,
  title,
  subtitle,
  children,
  footer,
  cta,
  brandIcon: BrandIcon = Sparkles,
  brandTitle = "ZEAL",
  features,
}: AuthShellProps) {
  const copy = COPY[mode];

  return (
    <div className="min-h-screen bg-[#0B0A14] flex relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-indigo-500/10 blur-[160px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-purple-500/[0.08] blur-[160px] pointer-events-none" />

      <aside className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-14 border-r border-white/[0.06]">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-purple-500/20">
            <BrandIcon size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-black tracking-wider text-lg leading-none">
              {brandTitle}
            </p>
            <p className="text-[10px] text-slate-500 tracking-[0.2em] font-bold uppercase mt-0.5">
              Zeal Platform
            </p>
          </div>
        </Link>

        <div className="max-w-lg">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight"
          >
            {copy.headline[0]}
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
              {copy.headline[1]}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-slate-400 text-base mt-6 max-w-md"
          >
            {copy.tagline}
          </motion.p>

          {features && features.length > 0 && (
            <ul className="mt-10 space-y-3.5">
              {features.map((f, i) => (
                <motion.li
                  key={f}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.35 + i * 0.08 }}
                  className="flex items-center gap-3 text-sm text-slate-300"
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-emerald-400" />
                  </div>
                  {f}
                </motion.li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-6 text-[11px] text-slate-600">
          <span>© {new Date().getFullYear()} Zeal</span>
          <span>•</span>
          <span>SOC 2</span>
          <span>•</span>
          <span>GDPR</span>
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center p-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center">
                <BrandIcon size={18} className="text-white" />
              </div>
              <span className="text-white font-black tracking-wider text-lg">
                {brandTitle}
              </span>
            </Link>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-white tracking-tight">
              {title}
            </h2>
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          </div>

          {children}

          {footer && <div className="mt-6">{footer}</div>}
          {cta && <div className="mt-8">{cta}</div>}
        </motion.div>
      </main>
    </div>
  );
}
EOF

write apps/web/components/auth/Field.tsx <<'EOF'
"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: LucideIcon;
  error?: string | null;
  hint?: string | null;
  showToggle?: boolean;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, icon: Icon, error, hint, showToggle, type = "text", id, className, ...rest },
  ref,
) {
  const [reveal, setReveal] = useState(false);
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const describedBy = error
    ? `${inputId}-err`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2"
      >
        {label}
      </label>

      <div className="relative group">
        {Icon && (
          <Icon
            size={17}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors pointer-events-none"
          />
        )}
        <input
          ref={ref}
          id={inputId}
          type={showToggle ? (reveal ? "text" : "password") : type}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={[
            "w-full py-3.5 bg-slate-900/60 border rounded-2xl text-sm text-white",
            "placeholder:text-slate-600 outline-none transition-colors",
            "focus:bg-slate-900/90",
            Icon ? "pl-12" : "pl-4",
            showToggle ? "pr-12" : "pr-4",
            error
              ? "border-rose-500/40 focus:border-rose-500"
              : "border-white/5 focus:border-purple-500",
            className ?? "",
          ].join(" ")}
          {...rest}
        />
        {showToggle && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={reveal ? "Hide password" : "Show password"}
            onClick={() => setReveal((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>

      {error ? (
        <p
          id={`${inputId}-err`}
          className="text-[10px] text-rose-400 mt-1.5 font-medium"
          role="alert"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-[10px] text-slate-500 mt-1.5">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
EOF

write apps/web/components/auth/PasswordStrength.tsx <<'EOF'
"use client";

import { motion } from "framer-motion";

export type Strength = 0 | 1 | 2 | 3 | 4;

const META: Record<Strength, { label: string; color: string; width: string }> = {
  0: { label: "",       color: "",               width: "0%" },
  1: { label: "Weak",   color: "bg-rose-500",    width: "25%" },
  2: { label: "Fair",   color: "bg-amber-500",   width: "50%" },
  3: { label: "Good",   color: "bg-blue-500",    width: "75%" },
  4: { label: "Strong", color: "bg-emerald-500", width: "100%" },
};

export function scorePassword(pw: string): Strength {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 12) s++;
  if (pw.length >= 16) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4) as Strength;
}

export function PasswordStrength({ value }: { value: string }) {
  const strength = scorePassword(value);
  const meta = META[strength];
  const remaining = Math.max(0, 12 - value.length);

  if (!value) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            animate={{ width: meta.width }}
            transition={{ duration: 0.4 }}
            className={`h-full ${meta.color} rounded-full`}
          />
        </div>
        <span
          className={[
            "text-[10px] font-black uppercase tracking-widest",
            strength <= 1
              ? "text-rose-400"
              : strength === 2
                ? "text-amber-400"
                : strength === 3
                  ? "text-blue-400"
                  : "text-emerald-400",
          ].join(" ")}
        >
          {meta.label}
        </span>
      </div>
      <p className="text-[10px] text-slate-500">
        {remaining === 0
          ? "✓ 12-character minimum met"
          : `${remaining} more character${remaining === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}
EOF

write apps/web/components/auth/RealtimeStatus.tsx <<'EOF'
"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";

type State = "checking" | "online" | "offline";

/** Small non-blocking badge — confirms Supabase Realtime is connected. */
export function RealtimeStatus() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setState("offline");
      return;
    }
    let mounted = true;
    const ch = sb.channel("auth:heartbeat");
    ch.subscribe((status) => {
      if (!mounted) return;
      if (status === "SUBSCRIBED") setState("online");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
        setState("offline");
    });
    return () => {
      mounted = false;
      void sb.removeChannel(ch);
    };
  }, []);

  if (state === "checking") return null;

  return (
    <div
      className={[
        "mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
        state === "online"
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          : "bg-slate-500/10 text-slate-400 border border-slate-500/20",
      ].join(" ")}
    >
      {state === "online" ? <Wifi size={11} /> : <WifiOff size={11} />}
      {state === "online" ? "Realtime connected" : "Realtime offline"}
    </div>
  );
}
EOF

# ═════════════════════════════════════════════════════════════════════════════
# 5. login page (web)
# ═════════════════════════════════════════════════════════════════════════════
write apps/web/app/login/page.tsx <<'EOF'
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
EOF

# ═════════════════════════════════════════════════════════════════════════════
# 6. register page (web)
# ═════════════════════════════════════════════════════════════════════════════
write apps/web/app/register/page.tsx <<'EOF'
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
EOF

# ═════════════════════════════════════════════════════════════════════════════
# 7. forgot-password page (web)
# ═════════════════════════════════════════════════════════════════════════════
write apps/web/app/forgot-password/page.tsx <<'EOF'
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
EOF

# ═════════════════════════════════════════════════════════════════════════════
# 8. reset-password page (web)
# ═════════════════════════════════════════════════════════════════════════════
write apps/web/app/reset-password/page.tsx <<'EOF'
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
EOF

# ═════════════════════════════════════════════════════════════════════════════
# 9. mfa-challenge page (web)
# ═════════════════════════════════════════════════════════════════════════════
write apps/web/app/mfa-challenge/page.tsx <<'EOF'
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
EOF

# ═════════════════════════════════════════════════════════════════════════════
# 10. auth callback (web)
# ═════════════════════════════════════════════════════════════════════════════
write apps/web/app/auth/callback/route.ts <<'EOF'
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { hasSupabaseEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/explore";

  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(`${origin}/login?error=config`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* RSC context */
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  const safeNext = next.startsWith("/") ? next : "/explore";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
EOF

# ═════════════════════════════════════════════════════════════════════════════
# 11. web middleware (env-safe)
# ═════════════════════════════════════════════════════════════════════════════
write apps/web/middleware.ts <<'EOF'
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/mfa-challenge",
  "/auth/callback",
  "/terms",
  "/privacy",
  "/not-found",
];

const AUTH_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

function isPrefetchOrRsc(req: NextRequest): boolean {
  const h = req.headers;
  const search = req.nextUrl.search || "";
  return (
    search.includes("_rsc=") ||
    h.get("rsc") === "1" ||
    h.get("next-router-prefetch") === "1" ||
    h.get("x-middleware-prefetch") === "1" ||
    h.get("purpose") === "prefetch"
  );
}

function noContent(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://*.r2.dev https://*.supabase.co https://ui-avatars.com https://images.unsplash.com https://picsum.photos https://lh3.googleusercontent.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel.app https://zeal-web-red.vercel.app https://zeal-admin-rose.vercel.app https://api.groq.com https://apihub.agnes-ai.com https://vitals.vercel-insights.com",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

function harden(res: NextResponse): NextResponse {
  res.headers.set("Content-Security-Policy", CSP);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Env-safe: without keys we can't authenticate. Pass through in dev so
  // local rendering works. Fail loudly in prod — a misconfig is a blocker.
  if (!AUTH_ENABLED) {
    if (process.env.NODE_ENV === "production") {
      console.error("[middleware] Supabase env missing in production");
      return harden(
        new NextResponse("Configuration error: Supabase env missing", {
          status: 500,
        }),
      );
    }
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/api/") &&
    request.headers.get("authorization")?.startsWith("Bearer ")
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  harden(response);

  if (isPublic(pathname)) return response;

  if (!user || authError) {
    if (isPrefetchOrRsc(request)) return noContent();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
EOF

# ═════════════════════════════════════════════════════════════════════════════
# 12. admin middleware (env-safe)
# ═════════════════════════════════════════════════════════════════════════════
write apps/admin/middleware.ts <<'EOF'
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/auth/callback",
  "/auth/handoff",
  "/not-found",
  "/terms",
  "/privacy",
];

const ADMIN_CONSOLE_PREFIXES = [
  "/dashboard",
  "/users",
  "/consultants",
  "/verification",
  "/bookings",
  "/withdrawals",
  "/analytics",
  "/broadcast",
  "/content",
  "/ai-consultants",
  "/recordings",
  "/wallet",
  "/settings",
  "/audit",
  "/impersonate",
  "/sessions",
];

const ADMIN_ROLES = new Set(["SUPPORT", "ADMIN", "SUPER_ADMIN", "VIEWER"]);

const AUTH_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

function isPrefetchOrRsc(req: NextRequest): boolean {
  const h = req.headers;
  const search = req.nextUrl.search || "";
  return (
    search.includes("_rsc=") ||
    h.get("rsc") === "1" ||
    h.get("next-router-prefetch") === "1" ||
    h.get("x-middleware-prefetch") === "1" ||
    h.get("purpose") === "prefetch"
  );
}

function noContent(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://*.r2.dev https://*.supabase.co https://ui-avatars.com https://images.unsplash.com https://picsum.photos https://lh3.googleusercontent.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel.app https://zeal-web-red.vercel.app https://api.groq.com https://apihub.agnes-ai.com https://vitals.vercel-insights.com",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

function harden(res: NextResponse): NextResponse {
  res.headers.set("Content-Security-Policy", CSP);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!AUTH_ENABLED) {
    if (process.env.NODE_ENV === "production") {
      console.error("[admin/middleware] Supabase env missing in production");
      return harden(
        new NextResponse("Configuration error: Supabase env missing", {
          status: 500,
        }),
      );
    }
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/api/") &&
    request.headers.get("authorization")?.startsWith("Bearer ")
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  harden(response);

  if (isPublic(pathname)) return response;

  if (!user || authError) {
    if (isPrefetchOrRsc(request)) return noContent();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  const role = (user.app_metadata?.role as string | undefined) ?? "USER";
  const isAdmin = ADMIN_ROLES.has(role);
  const isConsultant = role === "CLIENT_ADMIN";

  if (
    isConsultant &&
    ADMIN_CONSOLE_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    if (isPrefetchOrRsc(request)) return noContent();
    return NextResponse.redirect(new URL("/consultant/dashboard", request.url));
  }

  if (isAdmin && pathname.startsWith("/consultant")) {
    if (isPrefetchOrRsc(request)) return noContent();
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isAdmin && !isConsultant) {
    if (isPrefetchOrRsc(request)) return noContent();
    const webUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    if (webUrl) return NextResponse.redirect(`${webUrl}/explore`);
    return NextResponse.redirect(
      new URL("/login?error=not_authorized", request.url),
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
EOF

# ═════════════════════════════════════════════════════════════════════════════
# Summary
# ═════════════════════════════════════════════════════════════════════════════
hr "DONE"
echo "Backups of previous files: $BACKUP_DIR"
echo
c_dim "Files rewritten:"
echo "  apps/web/lib/env.ts"
echo "  apps/web/lib/supabase/client.ts"
echo "  apps/web/components/providers/SupabaseAuthProvider.tsx"
echo "  apps/web/components/auth/AuthShell.tsx"
echo "  apps/web/components/auth/Field.tsx"
echo "  apps/web/components/auth/PasswordStrength.tsx"
echo "  apps/web/components/auth/RealtimeStatus.tsx"
echo "  apps/web/app/login/page.tsx"
echo "  apps/web/app/register/page.tsx"
echo "  apps/web/app/forgot-password/page.tsx"
echo "  apps/web/app/reset-password/page.tsx"
echo "  apps/web/app/mfa-challenge/page.tsx"
echo "  apps/web/app/auth/callback/route.ts"
echo "  apps/web/middleware.ts"
echo "  apps/admin/middleware.ts"
echo
c_dim "Revert:  cp -r $BACKUP_DIR/. ."
c_dim "Next:   restart dev server, hard-reload browser"
c_grn "All done."