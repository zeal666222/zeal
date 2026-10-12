"use client";
// =============================================================================
// Consultant Settings — avatar + profile editor for consultant users
// =============================================================================
// Consultants are also Users, so we reuse updateProfileAction for the User-level
// fields (name, avatar). Consultant-specific fields (bio, rate, etc.) stay on
// the Consultant table via the PATCH /api/consultant/profile endpoint.
// =============================================================================

import { useActionState, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Home, Loader2, Save } from "lucide-react";
import { updateProfileAction, type ProfileActionState } from "@/actions/profile";
import { AvatarUpload } from "@/components/shared/AvatarUpload";
import { toast } from "@/components/ui/toaster";

interface UserProfile {
  name: string;
  username: string;
  avatar: string;
  bio: string;
}

export default function ConsultantSettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [state, formAction, isPending] = useActionState<ProfileActionState | null, FormData>(
    updateProfileAction,
    null,
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/users/me/profile", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { user: UserProfile };
        setProfile(data.user);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (state?.ok) {
      toast({ title: "Profile updated", variant: "success" });
    }
  }, [state]);

  const canSubmit = useCallback(() => {
    if (isPending) return false;
    return true;
  }, [isPending]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <p className="text-muted-foreground mb-5">Could not load your profile.</p>
          <button
            onClick={() => router.push("/consultant/dashboard")}
            className="inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white text-sm font-black"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push("/consultant/dashboard")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-purple-400 mb-8"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <div className="bg-surface backdrop-blur-xl border border-border rounded-[2.5rem] p-8 sm:p-12 shadow-2xl">
          <h1 className="text-3xl font-bold mb-2">Consultant Settings</h1>
          <p className="text-muted-foreground font-light mb-8">
            Update your public practice profile.
          </p>

          <form action={formAction} className="space-y-6">
            {state && !state.ok && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold"
              >
                {state.error}
              </motion.div>
            )}

            {/* Avatar */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Profile Photo
              </label>
              <AvatarUpload defaultValue={profile.avatar} size="lg" />
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Display Name
              </label>
              <input
                type="text"
                name="name"
                defaultValue={profile.name}
                maxLength={80}
                className="w-full px-4 py-3 bg-background border border-border rounded-2xl outline-none text-foreground focus:border-[var(--color-primary)] transition-colors"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <input
                  type="text"
                  name="username"
                  defaultValue={profile.username}
                  maxLength={30}
                  className="w-full pl-9 pr-4 py-3 bg-background border border-border rounded-2xl outline-none text-foreground font-mono text-sm focus:border-[var(--color-primary)] transition-colors"
                />
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Bio
              </label>
              <textarea
                name="bio"
                defaultValue={profile.bio}
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 bg-background border border-border rounded-2xl outline-none text-foreground resize-none focus:border-[var(--color-primary)] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit()}
              className="px-8 py-3.5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isPending ? (
                <><Loader2 size={15} className="animate-spin" /> Saving...</>
              ) : (
                <><Save size={15} /> Save Profile</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
