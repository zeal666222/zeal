"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// ConsultantTabs — client-side Posts / Reviews tab switcher
// ═══════════════════════════════════════════════════════════════════════════════
// The parent page is a Server Component, so tab state must live here.
// ═══════════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import Link from "next/link";

interface PostItem {
  id: string;
  content: string;
  mediaUrls: string[] | null;
  cheerCount: number | null;
  commentCount: number | null;
  createdAt: string | null;
}

interface ReviewItem {
  rating: number | null;
  review: string | null;
  updatedAt: string;
  reviewerName: string | null;
  reviewerAvatar: string | null;
}

interface Props {
  posts: PostItem[];
  reviews: ReviewItem[];
}

type Tab = "posts" | "reviews";

export function ConsultantTabs({ posts, reviews }: Props) {
  const [tab, setTab] = useState<Tab>("posts");

  return (
    <>
      {/* Tab header */}
      <div className="mb-4 flex items-center gap-4 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("posts")}
          className={`pb-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-all ${
            tab === "posts"
              ? "text-foreground border-[var(--color-primary)]"
              : "text-muted-foreground border-transparent hover:text-foreground"
          }`}
        >
          Posts ({posts.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("reviews")}
          className={`pb-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-all ${
            tab === "reviews"
              ? "text-foreground border-[var(--color-primary)]"
              : "text-muted-foreground border-transparent hover:text-foreground"
          }`}
        >
          Reviews ({reviews.length})
        </button>
      </div>

      {/* Panels */}
      {tab === "posts" ? (
        <PostsPanel posts={posts} />
      ) : (
        <ReviewsPanel reviews={reviews} />
      )}
    </>
  );
}

// ─── Posts grid ───────────────────────────────────────────────────────────────
function PostsPanel({ posts }: { posts: PostItem[] }) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed border-border rounded-3xl">
        <p className="text-muted-foreground text-sm">No posts yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1 md:gap-2">
      {posts.map((post) => (
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
            <div className="w-full h-full bg-gradient-to-br from-surface to-background flex items-center justify-center p-3">
              <p className="text-[10px] text-muted-foreground line-clamp-4 text-center">
                {post.content}
              </p>
            </div>
          )}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 text-white text-xs">
            <span>❤️ {post.cheerCount ?? 0}</span>
            <span>💬 {post.commentCount ?? 0}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Reviews list ─────────────────────────────────────────────────────────────
function ReviewsPanel({ reviews }: { reviews: ReviewItem[] }) {
  if (reviews.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed border-border rounded-3xl">
        <p className="text-muted-foreground text-sm">No reviews yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.slice(0, 10).map((r, i) => (
        <div
          key={i}
          className="p-4 bg-surface border border-border rounded-2xl"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-surface-sunken flex items-center justify-center text-xs font-bold text-foreground overflow-hidden">
              {r.reviewerAvatar ? (
                <img
                  src={r.reviewerAvatar}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                (r.reviewerName ?? "?").charAt(0).toUpperCase()
              )}
            </div>
            <span className="text-sm font-medium text-foreground">
              {r.reviewerName ?? "Anonymous"}
            </span>
            <span className="text-amber-400 text-xs ml-auto">
              {"⭐".repeat(Math.max(0, Math.min(5, r.rating ?? 0)))}
            </span>
          </div>
          {r.review && <p className="text-sm text-muted-foreground">{r.review}</p>}
        </div>
      ))}
    </div>
  );
}
