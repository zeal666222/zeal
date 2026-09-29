"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Post Detail — real data with reactions
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, Heart, Loader2, MessageCircle, Share2,
} from "lucide-react";
import { getImageUrl } from "@/lib/storage/r2";

interface PostData {
  id: string;
  content: string;
  mediaUrls: string[] | null;
  cheerCount: number;
  commentCount: number;
  createdAt: string;
  author: {
    id: string;
    username: string | null;
    name: string | null;
    avatar: string | null;
  } | null;
}

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cheered, setCheered] = useState(false);
  const [cheers, setCheers] = useState(0);

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/posts/${params.id}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Not found");
        const data = (await res.json()) as { post: PostData };
        if (!cancelled) {
          setPost(data.post);
          setCheers(data.post.cheerCount);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [params.id]);

  const handleCheer = async () => {
    if (!post) return;
    setCheered((v) => !v);
    setCheers((c) => (cheered ? c - 1 : c + 1));
    try {
      await fetch(`/api/posts/${post.id}/cheer`, {
        method: cheered ? "DELETE" : "POST",
      });
    } catch { /* revert on next load */ }
  };

  const handleShare = async () => {
    if (!post) return;
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ url, title: "Post on Zeal" });
      else await navigator.clipboard.writeText(url);
    } catch { /* user cancelled */ }
  };

  if (loading) {
    return (
      <div className="min-h-screen-app bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen-app bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">{error ?? "Post not found"}</p>
          <button
            onClick={() => router.push("/")}
            className="px-5 py-2.5 rounded-xl
                       bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                       text-white text-sm font-black"
          >
            Back to feed
          </button>
        </div>
      </div>
    );
  }

  const author = post.author;
  const displayName = author?.name || author?.username || "Anonymous";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen-app bg-background pb-24">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-surface-raised"
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
        </div>
      </div>

      <motion.article
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto px-4 pt-6"
      >
        <header className="flex items-center gap-3 mb-4">
          <Link
            href={author?.id ? `/profile?userId=${author.id}` : "#"}
            className="w-12 h-12 rounded-full overflow-hidden
                       bg-surface-raised flex items-center justify-center
                       font-black text-foreground"
          >
            {author?.avatar ? (
              <img src={author.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-foreground truncate">{displayName}</p>
            {author?.username && (
              <p className="text-xs text-muted-foreground font-mono">@{author.username}</p>
            )}
          </div>
        </header>

        {post.mediaUrls && post.mediaUrls.length > 0 && (
          <div className="rounded-3xl overflow-hidden border border-border mb-4">
            <img
              src={getImageUrl(post.mediaUrls[0], "detail")}
              alt=""
              className="w-full h-auto"
            />
          </div>
        )}

        <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap break-words">
          {post.content}
        </p>

        <footer className="flex items-center gap-6 mt-6 pt-4 border-t border-border">
          <button
            onClick={handleCheer}
            className={`flex items-center gap-1.5 text-sm font-bold transition-colors ${
              cheered ? "text-rose-400" : "text-muted-foreground hover:text-rose-400"
            }`}
          >
            <Heart size={16} className={cheered ? "fill-rose-400" : ""} />
            {cheers}
          </button>
          <span className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
            <MessageCircle size={16} />
            {post.commentCount}
          </span>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"
          >
            <Share2 size={16} /> Share
          </button>
        </footer>

        <p className="mt-6 text-[10px] uppercase tracking-widest text-muted-foreground font-black">
          {new Date(post.createdAt).toLocaleString("en-IN")}
        </p>
      </motion.article>
    </div>
  );
}
