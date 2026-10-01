// ═══════════════════════════════════════════════════════════════════════════════
// /u/[username] — public Instagram-style profile
// ═══════════════════════════════════════════════════════════════════════════════

import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient, getUserId } from "@zeal/database/server";
import { AlertTriangle, Check, MapPin, Link as LinkIcon, Sparkles } from "lucide-react";
import { PostGrid } from "@/components/profile/PostGrid";
import { EmptyState } from "@/components/shared/EmptyState";
import { PublicProfileActions } from "./PublicProfileActions";
import { RetryButton } from "./RetryButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ProfileUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  website: string | null;
  location: string | null;
  role: string;
  isVerified: boolean | null;
  is_online: boolean | null;
  sparks: number | null;
}
interface Stats {
  posts: number; cheers: number; comments: number;
  followers: number; following: number;
}
interface ProfilePayload {
  user?: ProfileUser;
  stats?: Stats;
  isConsultant?: boolean;
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const admin = createAdminClient();

  const { data: userRow } = await admin
    .from("User")
    .select("id")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  const userId = (userRow as { id?: string } | null)?.id;
  if (!userId) notFound();

  const { data: raw, error: statsError } = await admin.rpc("get_profile_stats", {
    p_user_id: userId,
  });

  // The user row exists but the stats RPC faulted — a transient DB error, not a
  // missing profile. Show a retryable error instead of a misleading 404.
  if (statsError) {
    return (
      <div className="min-h-screen-app bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load this profile"
            description="We hit a snag fetching the details. Please try again."
            action={<RetryButton />}
          />
          <div className="text-center">
            <Link
              href="/explore"
              className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to Explore
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const payload = (raw ?? {}) as ProfilePayload;
  const profile = payload.user;
  if (!profile) notFound();

  const viewerId = await getUserId();
  const isSelf = viewerId !== null && viewerId === userId;

  const stats = payload.stats;
  const displayName = profile.name || profile.username || "Seeker";
  const initial = displayName.charAt(0).toUpperCase();
  const isConsultant = payload.isConsultant === true;

  return (
    <div className="min-h-screen-app bg-background pb-24">
      {/* ─── Cover banner ────────────────────────────────────────────────── */}
      <div className="relative h-40 md:h-56 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br
                        from-[var(--color-primary)]/[0.18]
                        via-[var(--color-surface)]
                        to-[var(--color-luxury-gold)]/[0.15]" />
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px]
                        bg-[var(--color-primary)]/[0.22] blur-[160px] rounded-full" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px]
                        bg-[var(--color-luxury-gold)]/[0.16] blur-[160px] rounded-full" />
        <div className="absolute inset-0 noise-overlay opacity-60" />
      </div>

      <div className="max-w-5xl mx-auto px-4 relative -mt-16 md:-mt-20 z-10">
        {/* ─── Avatar + identity ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 mb-8">
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-1 rounded-full
                         bg-gradient-to-br from-[var(--color-luxury-gold)]/40
                         via-[var(--color-primary)]/30 to-transparent blur-md"
            />
            <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-full
                            ring-4 ring-background overflow-hidden
                            bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)]
                            flex items-center justify-center text-white font-black text-4xl">
              {profile.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                initial
              )}
            </div>
            {profile.is_online && (
              <span className="absolute bottom-2 right-2 w-5 h-5 rounded-full
                               bg-emerald-500 border-4 border-background animate-pulse" />
            )}
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left pb-2">
            <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
              <h1 className="text-2xl md:text-3xl font-black text-foreground truncate">
                {displayName}
              </h1>
              {profile.isVerified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                                 bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30
                                 text-[var(--color-primary)] text-[10px] font-black uppercase tracking-widest">
                  <Check size={10} /> Verified
                </span>
              )}
              {isConsultant && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                                 bg-[var(--color-luxury-gold)]/15 border border-[var(--color-luxury-gold)]/30
                                 text-[var(--color-luxury-gold)] text-[10px] font-black uppercase tracking-widest">
                  <Sparkles size={10} /> Consultant
                </span>
              )}
            </div>
            {profile.username && (
              <p className="mt-1 text-sm text-muted-foreground font-mono">@{profile.username}</p>
            )}
            <div className="mt-4 flex justify-center sm:justify-start">
              <PublicProfileActions userId={profile.id} isSelf={isSelf} />
            </div>
          </div>
        </div>

        {/* ─── Stats row ─────────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6 max-w-2xl">
            <Stat label="Posts" value={stats.posts} />
            <Stat label="Followers" value={stats.followers} />
            <Stat label="Following" value={stats.following} />
          </div>
        )}

        {/* ─── Bio + meta ────────────────────────────────────────────────── */}
        {(profile.bio || profile.location || profile.website) && (
          <div className="rounded-3xl border border-border bg-surface p-5 md:p-6 mb-8 max-w-2xl">
            {profile.bio && (
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                {profile.bio}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
              {profile.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={12} /> {profile.location}
                </span>
              )}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[var(--color-primary)] hover:underline truncate max-w-[240px]"
                >
                  <LinkIcon size={12} /> {profile.website}
                </a>
              )}
            </div>
          </div>
        )}

        {/* ─── Posts grid ────────────────────────────────────────────────── */}
        <div className="border-t border-border pt-6">
          <PostGrid userId={profile.id} />
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/explore"
            className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Explore
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">
        {label}
      </p>
      <p className="text-2xl font-black font-mono text-foreground mt-1 tabular-nums">
        {value.toLocaleString("en-IN")}
      </p>
    </div>
  );
}
