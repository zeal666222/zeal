"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Profile Edit — Instagram-style editor with live username check
// ═══════════════════════════════════════════════════════════════════════════════

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, ArrowLeft, Check, Command, Loader2, Save, X,
} from "lucide-react";
import { updateProfileAction, type ProfileActionState } from "@/actions/profile";
import { AvatarUpload } from "@/components/shared/AvatarUpload";
import { toast } from "@/components/ui/toaster";
import { useAppStore, type User as StoreUser } from "@/lib/store/appStore";

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
  const formRef = useRef<HTMLFormElement | null>(null);

  // Controlled mirrors of the fields we need for dirty tracking + counters.
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);

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
        setName(data.user.name ?? "");
        setBio(data.user.bio ?? "");
        setWebsite(data.user.website ?? "");
        setLocation(data.user.location ?? "");
        setAvatar(data.user.avatar ?? null);
      } catch {
        setError("load");
      } finally {
        setLoading(false);
      }
    })();
  }, [retryKey]);

  const dirty = !!initial && (
    name !== (initial.name ?? "") ||
    username !== (initial.username ?? "") ||
    bio !== (initial.bio ?? "") ||
    website !== (initial.website ?? "") ||
    location !== (initial.location ?? "") ||
    (avatar ?? "") !== (initial.avatar ?? "")
  );

  // Guard against closing the tab mid-edit. Only attach when there's real
  // unsaved work so a plain back-click from a fresh form doesn't nag.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // ⌘/Ctrl+S submits; Esc goes back. Attached only while the form is dirty so
  // a stray keypress on a fresh form doesn't hit the network.
  useEffect(() => {
    if (!dirty) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!isPending && formRef.current?.requestSubmit) formRef.current.requestSubmit();
        else formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        return;
      }
      if (e.key === "Escape") {
        const target = e.target as HTMLElement | null;
        // Don't hijack Escape while a native select/picker is open.
        if (target && (target.tagName === "SELECT" || target.getAttribute("role") === "dialog")) return;
        router.back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, isPending, router]);

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
      // Optimistically push DB-authoritative fields into the shared store so
      // every mounted header/nav icon swaps the avatar instantly, without
      // waiting for the Supabase realtime broadcast round-trip.
      const u = state.user as {
        avatar?: string | null;
        name?: string | null;
        username?: string;
        bio?: string | null;
        website?: string | null;
        location?: string | null;
        sparks?: number;
        isVerified?: boolean;
        role?: string;
      };
      const patch: Partial<StoreUser> = {};
      if ("avatar" in u) patch.avatar = u.avatar ?? null;
      if ("name" in u) patch.name = u.name ?? null;
      if (typeof u.username === "string") patch.username = u.username;
      if ("bio" in u) patch.bio = u.bio ?? null;
      if (typeof u.sparks === "number") patch.sparks = u.sparks;
      if (typeof u.isVerified === "boolean") patch.isVerified = u.isVerified;
      if (Object.keys(patch).length > 0) {
        useAppStore.getState().updateUser(patch);
      }
      // Snap the local form baseline so the sticky save bar clears and the
      // beforeunload guard releases before the redirect fires.
      setInitial((prev) => prev ? {
        name: u.name ?? prev.name,
        username: u.username ?? prev.username,
        bio: u.bio ?? prev.bio,
        website: u.website ?? prev.website,
        location: u.location ?? prev.location,
        avatar: u.avatar ?? prev.avatar,
      } : prev);
      setAvatar(u.avatar ?? null);
      toast({ title: "Profile updated", variant: "success" });
      setTimeout(() => router.push("/profile"), 800);
    }
  }, [state, router]);

  const canSubmit = useCallback(() => {
    if (isPending) return false;
    if (usernameStatus.kind === "checking" || usernameStatus.kind === "taken" || usernameStatus.kind === "invalid") return false;
    return true;
  }, [isPending, usernameStatus.kind]);

  const submitting = isPending;

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
            className="inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white text-sm font-black"
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
            className="inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white text-sm font-black"
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

      <form id="profile-edit" ref={formRef} action={formAction} className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {state && !state.ok && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-start gap-2"
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{state.error}</span>
          </motion.div>
        )}

        <Field
          label="Name"
          name="name"
          value={name}
          onChange={setName}
          maxLength={80}
          counter
        />

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
              className="w-full pl-9 pr-10 py-3.5 bg-surface border border-border rounded-2xl text-sm font-mono text-foreground outline-none focus:border-[var(--color-primary)] transition-colors"
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
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="bio"
              className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest"
            >
              Bio
            </label>
            <span
              className={
                "text-[10px] font-mono tabular-nums " +
                (bio.length > 450 ? "text-amber-400" : "text-muted-foreground")
              }
            >
              {bio.length}/500
            </span>
          </div>
          <textarea
            id="bio"
            name="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={500}
            className="w-full px-4 py-3.5 bg-surface border border-border rounded-2xl text-sm text-foreground resize-none outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>

        <Field
          label="Website"
          name="website"
          type="url"
          value={website}
          onChange={setWebsite}
          placeholder="https://your-site.com"
          maxLength={200}
        />

        <Field
          label="Location"
          name="location"
          value={location}
          onChange={setLocation}
          placeholder="Mumbai, India"
          maxLength={100}
        />

        <div>
          <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
            Avatar
          </label>
          <AvatarUpload
            defaultValue={initial.avatar}
            size="lg"
            onUploaded={(url) => {
              setAvatar(url);
              // Header chip + any mounted profile hero swap in the same frame
              // the file lands in storage — no wait for the form action.
              useAppStore.getState().updateUser({ avatar: url });
            }}
          />
        </div>

        <div className="flex gap-3 pt-4 pb-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3.5 rounded-2xl bg-surface-raised border border-border text-muted-foreground text-sm font-black"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit()}
            className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white text-sm font-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPending ? (
              <><Loader2 size={15} className="animate-spin" /> Saving…</>
            ) : (
              <>
                <Save size={15} /> Save changes
                <span className="ml-1 hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono opacity-70">
                  <Command size={9} />S
                </span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Sticky save bar — glides up when there are unsaved edits. Uses
          form="profile-edit" so it submits without living inside the DOM
          subtree. Hidden while isPending so we don't double-submit. */}
      <AnimatePresence>
        {dirty && !submitting && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pointer-events-none"
          >
            <div className="pointer-events-auto mx-auto max-w-2xl">
              <div
                className="rounded-[26px] p-px"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 55%, transparent), color-mix(in srgb, var(--color-luxury-gold) 45%, transparent))",
                }}
              >
                <div className="flex items-center justify-between gap-3 rounded-[25px] bg-[color-mix(in_srgb,var(--color-background)_88%,transparent)] backdrop-blur-2xl px-4 py-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="relative inline-flex h-2 w-2 shrink-0">
                      <span className="absolute inset-0 rounded-full bg-amber-400 opacity-75 animate-ping" />
                      <span className="relative rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                    <p className="truncate text-[12px] font-black text-foreground">
                      Unsaved changes
                    </p>
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                      <Command size={9} />S to save
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => router.back()}
                      className="px-3 py-2 rounded-xl text-[11px] font-black text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Discard
                    </button>
                    <button
                      type="submit"
                      form="profile-edit"
                      disabled={!canSubmit()}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white text-[11px] font-black shadow-lg shadow-[var(--color-primary)]/25 hover:opacity-95 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {submitting ? (
                        <><Loader2 size={12} className="animate-spin" /> Saving</>
                      ) : (
                        <><Check size={12} /> Save</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  maxLength,
  counter,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  counter?: boolean;
}) {
  const nearLimit = counter && maxLength ? value.length > maxLength * 0.9 : false;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label
          htmlFor={name}
          className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest"
        >
          {label}
        </label>
        {counter && maxLength ? (
          <span
            className={
              "text-[10px] font-mono tabular-nums " +
              (nearLimit ? "text-amber-400" : "text-muted-foreground")
            }
          >
            {value.length}/{maxLength}
          </span>
        ) : null}
      </div>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full px-4 py-3.5 bg-surface border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[var(--color-primary)] transition-colors"
      />
    </div>
  );
}
