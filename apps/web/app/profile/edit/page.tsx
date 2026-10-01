"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Profile Edit — Instagram-style editor with live username check
// ═══════════════════════════════════════════════════════════════════════════════

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle, ArrowLeft, Check, Loader2, Save, X,
} from "lucide-react";
import { updateProfileAction, type ProfileActionState } from "@/actions/profile";
import { toast } from "@/components/ui/toaster";

interface Initial {
  name: string;
  username: string;
  bio: string;
  website: string;
  location: string;
  avatar: string;
}

export default function ProfileEditPage() {
  const router = useRouter();
  const [initial, setInitial] = useState<Initial | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"load" | "signedout" | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "available" }
    | { kind: "taken"; message: string }
    | { kind: "invalid"; message: string }
  >({ kind: "idle" });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, formAction, isPending] = useActionState<ProfileActionState | null, FormData>(
    updateProfileAction,
    null,
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/users/me/profile", { cache: "no-store" });
        if (res.status === 401) { setError("signedout"); return; }
        if (!res.ok) { setError("load"); return; }
        const data = (await res.json()) as { user: Initial };
        setInitial(data.user);
        setUsername(data.user.username ?? "");
      } catch {
        setError("load");
      } finally {
        setLoading(false);
      }
    })();
  }, [retryKey]);

  // Live username check
  useEffect(() => {
    if (!initial) return;
    if (username === initial.username) {
      setUsernameStatus({ kind: "idle" });
      return;
    }
    if (username.length < 3) {
      setUsernameStatus({ kind: "invalid", message: "At least 3 characters" });
      return;
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      setUsernameStatus({ kind: "invalid", message: "Only letters, numbers, and _" });
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setUsernameStatus({ kind: "checking" });
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/me/profile?action=check-username&q=${encodeURIComponent(username)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          setUsernameStatus({ kind: "idle" });
          return;
        }
        const data = (await res.json()) as {
          available: boolean;
          reserved: boolean;
          reason?: string;
          message?: string;
        };
        if (data.reserved) {
          setUsernameStatus({ kind: "taken", message: "Reserved username" });
        } else if (!data.available) {
          setUsernameStatus({ kind: "taken", message: "Already taken" });
        } else {
          setUsernameStatus({ kind: "available" });
        }
      } catch {
        setUsernameStatus({ kind: "idle" });
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username, initial]);

  // Success feedback
  useEffect(() => {
    if (state?.ok) {
      toast({ title: "Profile updated", variant: "success" });
      setTimeout(() => router.push("/profile"), 800);
    }
  }, [state, router]);

  const canSubmit = useCallback(() => {
    if (isPending) return false;
    if (usernameStatus.kind === "checking" || usernameStatus.kind === "taken" || usernameStatus.kind === "invalid") return false;
    return true;
  }, [isPending, usernameStatus.kind]);

  if (loading) {
    return (
      <div className="min-h-screen-app bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (error === "signedout") {
    return (
      <div className="min-h-screen-app bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-5">Please sign in to edit your profile.</p>
          <Link
            href="/login"
            className="inline-block px-5 py-2.5 rounded-xl
                       bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                       text-white text-sm font-black"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (error === "load" || !initial) {
    return (
      <div className="min-h-screen-app bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle size={40} className="text-rose-400 mx-auto mb-3" />
          <p className="text-muted-foreground mb-5">Couldn’t load your profile editor.</p>
          <button
            type="button"
            onClick={() => { setError(null); setLoading(true); setRetryKey((k) => k + 1); }}
            className="inline-block px-5 py-2.5 rounded-xl
                       bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                       text-white text-sm font-black"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen-app bg-background pb-24">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-surface-raised"
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-sm font-black text-foreground">Edit profile</h1>
          <div className="w-8" />
        </div>
      </div>

      <form action={formAction} className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {state && !state.ok && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20
                       text-rose-400 text-xs font-bold flex items-start gap-2"
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{state.error}</span>
          </motion.div>
        )}

        <Field label="Name" name="name" defaultValue={initial.name} maxLength={80} />

        <div>
          <label
            htmlFor="username"
            className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2"
          >
            Username
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              @
            </span>
            <input
              id="username"
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              maxLength={30}
              className="w-full pl-9 pr-10 py-3.5 bg-surface border border-border rounded-2xl
                         text-sm font-mono text-foreground
                         outline-none focus:border-[var(--color-primary)] transition-colors"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {usernameStatus.kind === "checking" && (
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
              )}
              {usernameStatus.kind === "available" && (
                <Check size={14} className="text-emerald-400" />
              )}
              {(usernameStatus.kind === "taken" || usernameStatus.kind === "invalid") && (
                <X size={14} className="text-rose-400" />
              )}
            </div>
          </div>
          {usernameStatus.kind === "taken" && (
            <p className="text-[10px] text-rose-400 mt-1.5 font-bold">{usernameStatus.message}</p>
          )}
          {usernameStatus.kind === "invalid" && (
            <p className="text-[10px] text-rose-400 mt-1.5 font-bold">{usernameStatus.message}</p>
          )}
          {usernameStatus.kind === "available" && (
            <p className="text-[10px] text-emerald-400 mt-1.5 font-bold">Available</p>
          )}
        </div>

        <div>
          <label
            htmlFor="bio"
            className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2"
          >
            Bio
          </label>
          <textarea
            id="bio"
            name="bio"
            defaultValue={initial.bio}
            rows={4}
            maxLength={500}
            className="w-full px-4 py-3.5 bg-surface border border-border rounded-2xl
                       text-sm text-foreground resize-none
                       outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>

        <Field
          label="Website"
          name="website"
          type="url"
          defaultValue={initial.website}
          placeholder="https://your-site.com"
          maxLength={200}
        />

        <Field
          label="Location"
          name="location"
          defaultValue={initial.location}
          placeholder="Mumbai, India"
          maxLength={100}
        />

        <input type="hidden" name="avatar" value={initial.avatar} />

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3.5 rounded-2xl bg-surface-raised border border-border
                       text-muted-foreground text-sm font-black"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit()}
            className="flex-1 py-3.5 rounded-2xl
                       bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                       text-white text-sm font-black
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            {isPending ? (
              <><Loader2 size={15} className="animate-spin" /> Saving…</>
            ) : (
              <><Save size={15} /> Save changes</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full px-4 py-3.5 bg-surface border border-border rounded-2xl
                   text-sm text-foreground
                   placeholder:text-muted-foreground
                   outline-none focus:border-[var(--color-primary)] transition-colors"
      />
    </div>
  );
}
