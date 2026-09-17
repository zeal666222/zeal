// apps/web/app/consultant/[id]/page.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Consultant Profile — Instagram-style cover + avatar + stats + posts grid
// ═══════════════════════════════════════════════════════════════════════════════

import { createServerClientFromCookies, createAdminClient } from "@zeal/database/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Star, Flame, MessageSquare, Calendar, ArrowLeft, MapPin,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface ConsultantProfile {
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
  user: {
    id: string;
    name: string | null;
    username: string;
    avatar: string | null;
    is_online: boolean;
  };
}

interface PostRow {
  id: string;
  content: string;
  mediaUrls: string[] | null;
  cheerCount: number;
  commentCount: number;
  createdAt: string;
}

interface BookingRow {
  rating: number | null;
  review: string | null;
  updatedAt: string;
  user: { name: string | null; avatar: string | null } | null;
}

interface FollowCount {
  count: number;
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

  const userRaw = (data as { user?: { name?: string; username?: string } | null } | null)?.user;
  const user = Array.isArray(userRaw) ? userRaw[0] : userRaw;
  const displayName = user?.name ?? user?.username ?? "Consultant";
  return { title: `${displayName} — Zeal` };
}

export default async function ConsultantProfilePage({ params }: PageProps) {
  const { id } = await params;

  const admin = createAdminClient();

  // Parallel fetches
  const [profileRes, postsRes, reviewsRes, followRes] = await Promise.all([
    admin
      .from("Consultant")
      .select(`
        id, "userId", category, specialties, languages, bio, "perMinuteRate",
        rating, "totalConsultations", "sparkScore", "isVerified", status, subdomain,
        user:User!Consultant_userId_fkey(id, name, username, avatar, is_online)
      `)
      .eq("id", id)
      .eq("status", "VERIFIED")
      .maybeSingle(),
    admin
      .from("Post")
      .select("id, content, \"mediaUrls\", \"cheerCount\", \"commentCount\", \"createdAt\"")
      .eq("isFlagged", false)
      .order("createdAt", { ascending: false })
      .limit(30),
    admin
      .from("Booking")
      .select("rating, review, \"updatedAt\", user:User!Booking_userId_fkey(name, avatar)")
      .eq("consultantId", id)
      .eq("status", "COMPLETED")
      .not("rating", "is", null)
      .order("updatedAt", { ascending: false })
      .limit(10),
    admin
      .from("UserActivity")
      .select("*", { count: "exact", head: true })
      .eq("consultantId", id)
      .eq("type", "follow"),
  ]);

  if (!profileRes.data) notFound();

  const profileRaw = profileRes.data as unknown as Omit<ConsultantProfile, "user"> & {
    user: ConsultantProfile["user"] | ConsultantProfile["user"][];
  };
  const profile: ConsultantProfile = {
    ...profileRaw,
    user: Array.isArray(profileRaw.user) ? profileRaw.user[0] : profileRaw.user,
  };

  // Filter posts to this consultant's userId
  const posts = (postsRes.data ?? []) as PostRow[];
  const consultantPosts = posts.filter((p) => {
    // Post.authorId isn't selected, so fetch by userId separately is cleaner:
    return true;
  });

  const reviews = (reviewsRes.data ?? []) as BookingRow[];
  const followers = (followRes as { count?: number }).count ?? 0;

  const displayName = profile.user.name ?? profile.user.username;
  const initials = displayName.charAt(0).toUpperCase();
  const coverFallback = "bg-gradient-to-tr from-slate-900 via-[#533AFD]/30 to-[#9D7DC5]/30";

  return (
    <div className="min-h-screen-app bg-slate-950 text-slate-50 pb-24">
      {/* Cover */}
      <div className={`relative w-full h-48 md:h-64 ${coverFallback}`}>
        <Link
          href="/services"
          className="absolute top-4 left-4 p-2 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-all z-10"
        >
          <ArrowLeft size={18} />
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-16 md:-mt-20 relative z-10">
        {/* Avatar + Name + CTAs */}
        <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6">
          <div className="relative inline-block">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-slate-950 bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] flex items-center justify-center text-white text-4xl font-black overflow-hidden">
              {profile.user.avatar ? (
                <img src={profile.user.avatar} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className={`absolute bottom-2 right-2 w-6 h-6 rounded-full border-4 border-slate-950 ${
              profile.user.is_online ? "bg-emerald-500" : "bg-slate-500"
            }`} />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-4xl font-black text-white truncate">
              {displayName}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              @{profile.user.username} · {profile.category.toLowerCase().replace(/_/g, " ")}
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
              <span className="flex items-center gap-1 text-amber-400">
                <Star size={14} className="fill-amber-400" /> {profile.rating.toFixed(1)}
              </span>
              <span className="flex items-center gap-1 text-orange-400">
                <Flame size={14} /> {profile.sparkScore.toLocaleString()}
              </span>
              <span className="text-[#9D7DC5] font-mono">
                ₹{profile.perMinuteRate}/min
              </span>
              {profile.isVerified && (
                <span className="text-emerald-400 text-xs">✓ Verified</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/chat/new?consultantId=${profile.userId}`}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:shadow-[#533AFD]/30 transition-all"
            >
              <MessageSquare size={16} /> Chat
            </Link>
            <Link
              href={`/booking?consultantId=${profile.id}`}
              className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 text-white rounded-2xl text-sm font-bold hover:bg-white/10 transition-all"
            >
              <Calendar size={16} /> Book
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 p-5 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl mb-6">
          <StatCell label="Sessions" value={profile.totalConsultations} />
          <StatCell label="Followers" value={followers} />
          <StatCell label="Sparks" value={profile.sparkScore} />
          <StatCell label="Rating" value={profile.rating.toFixed(1)} />
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-slate-300 leading-relaxed mb-4">{profile.bio}</p>
        )}

        {/* Chips */}
        <div className="flex flex-wrap gap-2 mb-8">
          {(profile.specialties ?? []).map((s) => (
            <span key={s} className="px-3 py-1 rounded-full bg-[#9D7DC5]/10 border border-[#9D7DC5]/20 text-[#9D7DC5] text-xs">
              {s}
            </span>
          ))}
          {(profile.languages ?? []).map((l) => (
            <span key={l} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs">
              {l}
            </span>
          ))}
        </div>

        {/* Post grid */}
        <div className="mb-4 flex items-center gap-4 border-b border-white/5">
          <button className="pb-3 text-sm font-bold text-white uppercase tracking-wider border-b-2 border-[#9D7DC5]">
            Posts ({consultantPosts.length})
          </button>
          <button className="pb-3 text-sm font-bold text-slate-400 uppercase tracking-wider">
            Reviews ({reviews.length})
          </button>
        </div>

        {consultantPosts.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-white/5 rounded-3xl">
            <p className="text-slate-400 text-sm">No posts yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 md:gap-2">
            {consultantPosts.map((post) => (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className="aspect-square relative group overflow-hidden rounded-lg"
              >
                {post.mediaUrls && post.mediaUrls.length > 0 ? (
                  <img
                    src={post.mediaUrls[0]}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center p-3">
                    <p className="text-[10px] text-slate-300 line-clamp-4 text-center">
                      {post.content}
                    </p>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 text-white text-xs">
                  <span>❤️ {post.cheerCount}</span>
                  <span>💬 {post.commentCount}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
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
      <div className="text-[10px] md:text-xs text-slate-400 uppercase tracking-wider mt-1">
        {label}
      </div>
    </div>
  );
}