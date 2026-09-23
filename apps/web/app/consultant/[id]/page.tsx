// ZEAL_PHASE2_V1
// ═══════════════════════════════════════════════════════════════════════════════
// Consultant Profile — server component with premium hero + ProfileActions
// ═══════════════════════════════════════════════════════════════════════════════

import { createAdminClient } from "@zeal/database/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Flame, Star } from "lucide-react";
import { ConsultantTabs } from "./ConsultantTabs";
import { ProfileActions } from "./ProfileActions";

export const dynamic = "force-dynamic";

type Relation<T> = T | T[] | null | undefined;
function pickOne<T>(relation: Relation<T>): T | null {
  if (relation == null) return null;
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation;
}

interface UserRelation {
  id: string;
  name: string | null;
  username: string;
  avatar: string | null;
  is_online: boolean;
}

interface ConsultantRow {
  id: string;
  userId: string;
  category: string;
  specialties: string[] | null;
  languages: string[] | null;
  bio: string | null;
  perMinuteRate: number;
  rating: number;
  totalConsultations: number;
  sparkScore: number;
  isVerified: boolean;
  status: string;
  subdomain: string | null;
  user: Relation<UserRelation>;
}

interface PostRow {
  id: string;
  content: string;
  mediaUrls: string[] | null;
  cheerCount: number | null;
  commentCount: number | null;
  createdAt: string | null;
}

interface BookingReviewRow {
  rating: number | null;
  review: string | null;
  updatedAt: string;
  user: Relation<{ name: string | null; avatar: string | null }>;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("Consultant")
    .select("user:User!Consultant_userId_fkey(name, username)")
    .eq("id", id)
    .maybeSingle();

  const rel = (data as { user?: Relation<{ name?: string | null; username?: string }> } | null)
    ?.user;
  const user = pickOne(rel);
  const displayName = user?.name ?? user?.username ?? "Consultant";
  return { title: `${displayName} — Zeal` };
}

export default async function ConsultantProfilePage({ params }: PageProps) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: profileData } = await admin
    .from("Consultant")
    .select(`
      id, "userId", category, specialties, languages, bio, "perMinuteRate",
      rating, "totalConsultations", "sparkScore", "isVerified", status, subdomain,
      user:User!Consultant_userId_fkey(id, name, username, avatar, is_online)
    `)
    .eq("id", id)
    .eq("status", "VERIFIED")
    .maybeSingle();

  if (!profileData) notFound();

  const profileRow = profileData as unknown as ConsultantRow;
  const userRel = pickOne(profileRow.user);
  if (!userRel) notFound();
  const user: UserRelation = userRel;

  const [postsRes, reviewsRes, followRes] = await Promise.all([
    admin
      .from("Post")
      .select('id, content, "mediaUrls", "cheerCount", "commentCount", "createdAt"')
      .eq("authorId", profileRow.userId)
      .eq("isFlagged", false)
      .order("createdAt", { ascending: false })
      .limit(30),
    admin
      .from("Booking")
      .select('rating, review, "updatedAt", user:User!Booking_userId_fkey(name, avatar)')
      .eq("consultantId", profileRow.id)
      .eq("status", "COMPLETED")
      .not("rating", "is", null)
      .order("updatedAt", { ascending: false })
      .limit(10),
    admin
      .from("UserActivity")
      .select("*", { count: "exact", head: true })
      .eq("consultantId", profileRow.id)
      .eq("type", "follow"),
  ]);

  const posts = (postsRes.data ?? []) as PostRow[];
  const reviewsRaw = (reviewsRes.data ?? []) as BookingReviewRow[];
  const followers = (followRes as { count?: number | null }).count ?? 0;

  const reviews = reviewsRaw.map((r) => {
    const reviewer = pickOne(r.user);
    return {
      rating: r.rating,
      review: r.review,
      updatedAt: r.updatedAt,
      reviewerName: reviewer?.name ?? null,
      reviewerAvatar: reviewer?.avatar ?? null,
    };
  });

  const displayName = user.name ?? user.username;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen-app bg-slate-950 text-slate-50 pb-24">
      {/* Cover */}
      <div className="relative w-full h-56 md:h-72 noise-overlay overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0B0A14] via-[#1A1430] to-[#0B0A14]" />
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-[var(--color-luxury-gold)]/10 blur-[160px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#9D7DC5]/12 blur-[160px] pointer-events-none" />
        <Link
          href="/explore"
          aria-label="Back to explore"
          className="absolute top-4 left-4 z-10 p-2.5 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-20 md:-mt-24 relative z-10">
        {/* Avatar + identity */}
        <div className="flex flex-col md:flex-row md:items-end gap-5 mb-8">
          <div className="relative inline-block">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full bg-[var(--color-luxury-gold)]/25 blur-xl"
            />
            <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-slate-950 bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] flex items-center justify-center text-white text-4xl font-black overflow-hidden">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div
              className={`absolute bottom-3 right-3 w-6 h-6 rounded-full border-4 border-slate-950 ${
                user.is_online ? "bg-emerald-500 animate-pulse" : "bg-slate-500"
              }`}
              aria-label={user.is_online ? "Online" : "Offline"}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h1
              className="text-3xl md:text-4xl font-black text-white truncate"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {displayName}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              @{user.username} ·{" "}
              {profileRow.category.toLowerCase().replace(/_/g, " ")}
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
              <span className="flex items-center gap-1 text-amber-400">
                <Star size={14} className="fill-amber-400" />
                {profileRow.rating.toFixed(1)}
              </span>
              <span className="flex items-center gap-1 text-orange-400">
                <Flame size={14} /> {profileRow.sparkScore.toLocaleString()}
              </span>
              <span className="text-[var(--color-luxury-gold)] font-mono font-bold">
                ₹{profileRow.perMinuteRate}/min
              </span>
              {profileRow.isVerified && (
                <span className="text-emerald-400 text-xs">✓ Verified</span>
              )}
            </div>
          </div>
        </div>

        {/* CTAs — ProfileActions owns the wallet gate + realtime presence */}
        <ProfileActions
          consultantId={profileRow.id}
          consultantName={displayName}
          perMinuteRate={profileRow.perMinuteRate}
          isOnline={Boolean(user.is_online)}
          isAI={false}
        />

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 p-5 glass-luxury rounded-2xl mt-6">
          <StatCell label="Sessions" value={profileRow.totalConsultations} />
          <StatCell label="Followers" value={followers} />
          <StatCell label="Sparks" value={profileRow.sparkScore} />
          <StatCell label="Rating" value={profileRow.rating.toFixed(1)} />
        </div>

        {/* Bio */}
        {profileRow.bio && (
          <p className="text-slate-300 leading-relaxed mt-6">{profileRow.bio}</p>
        )}

        {/* Chips */}
        <div className="flex flex-wrap gap-2 mt-4">
          {(profileRow.specialties ?? []).map((s: string) => (
            <span
              key={s}
              className="px-3 py-1 rounded-full bg-[var(--color-luxury-gold)]/10 border border-[var(--color-luxury-gold)]/20 text-[var(--color-luxury-gold)] text-xs"
            >
              {s}
            </span>
          ))}
          {(profileRow.languages ?? []).map((l: string) => (
            <span
              key={l}
              className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs"
            >
              {l}
            </span>
          ))}
        </div>

        {/* Tabs */}
        <div className="mt-8">
          <ConsultantTabs posts={posts} reviews={reviews} />
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-lg md:text-2xl font-black text-white font-mono">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="text-[10px] md:text-xs text-slate-500 uppercase tracking-wider mt-1">
        {label}
      </div>
    </div>
  );
}
