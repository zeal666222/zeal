"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertCircle, ArrowRight, Briefcase, Loader2, Lock, Mail,
  MailCheck, Sparkles, User as UserIcon,
} from "lucide-react";
import { registerConsultantAction } from "@/actions/register";

function Content() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [email, setEmail] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    setEmail(String(fd.get("email") ?? ""));
    const res = await registerConsultantAction(fd);
    if (res.ok) {
      if (res.needsConfirmation) {
        setNeedsConfirm(true);
        setLoading(false);
        return;
      }
      router.push(res.destination ?? "/consultant/dashboard");
      return;
    }
    setError(res.error ?? "Registration failed");
    setLoading(false);
  };

  if (needsConfirm) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
            <MailCheck size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Check your inbox</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            We sent a confirmation link to{" "}
            <strong className="text-white">{email}</strong>.
          </p>
          <a
            href="/login"
            className="inline-flex items-center gap-2 mt-8 px-6 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-black text-sm"
          >
            Go to Sign In <ArrowRight size={15} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 blur-[180px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 shadow-2xl mb-5">
            <Briefcase size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Join the Consultant Studio
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Instant activation · 90% revenue share
          </p>
        </div>

        {error && (
          <div className="mb-5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-start gap-2.5">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <Field name="fullName" icon={UserIcon} label="Full Name"
            placeholder="Your full name" autoComplete="name" />
          <Field name="email" type="email" icon={Mail} label="Email"
            placeholder="you@example.com" autoComplete="email" />
          <Field name="password" type="password" icon={Lock}
            label="Password (min 12 chars)" placeholder="••••••••••••"
            autoComplete="new-password" minLength={12} />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Creating...</>
            ) : (
              <>Create Consultant Account <ArrowRight size={15} /></>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-7">
          Already have a consultant account?{" "}
          <a href="/login" className="text-purple-400 font-bold">Sign in</a>
        </p>

        <p className="text-center text-xs text-slate-500 mt-4 pt-4 border-t border-white/5">
          <Sparkles size={11} className="inline mr-1.5 text-purple-400" />
          Just looking for guidance?{" "}
          <a
            href={`${process.env.NEXT_PUBLIC_APP_URL}/register`}
            className="text-purple-400 font-bold"
          >
            Join as a Seeker
          </a>
        </p>
      </motion.div>
    </div>
  );
}

function Field({
  name, icon: Icon, label, placeholder,
  type = "text", autoComplete, minLength,
}: {
  name: string;
  icon: typeof Mail;
  label: string;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  minLength?: number;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
        {label}
      </label>
      <div className="relative">
        <Icon size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
        <input
          name={name}
          type={type}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-white/5 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none focus:bg-slate-900/90 focus:border-purple-500"
        />
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <Content />
    </Suspense>
  );
}
