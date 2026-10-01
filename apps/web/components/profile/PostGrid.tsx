"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// PostGrid — Instagram-style 3-column grid with detail modal
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Heart, ImageIcon, Loader2, MessageCircle, Trash2, X,
} from "lucide-react";
import { getImageUrl } from "@/lib/storage/r2";
import { deletePostAction } from "@/actions/profile";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@zeal/ui";
import { toast } from "@/components/ui/toaster";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";

interface PostItem {
  id: string;
  content: string;
  imageUrl: string | null;
  mediaUrls: string[];
  mediaType: string;
  cheerCount: number;
  commentCount: number;
  createdAt: string;
}

interface Props {
  userId: string;
  isSelf?: boolean;
  onDeleted?: () => void;
}

const GRID_LIMIT = 30;

export function PostGrid({ userId, isSelf = false, onDeleted }: Props) {
  const [selected, setSelected] = useState<PostItem | null>(null);
  const [slide, setSlide] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<{ items: PostItem[] }>({
    queryKey: ["profile", "posts", userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/posts?limit=${GRID_LIMIT}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: Boolean(userId),
  });

  // Realtime: prepend new posts
  useChannel<BroadcastChange<{ authorId?: string; id?: string }>>({
    channel: "feed:posts",
    event: "*",
    onMessage: (payload) => {
      if (payload?.type !== "INSERT") return;
      if (payload.record?.authorId !== userId) return;
      void refetch();
    },
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const fd = new FormData();
      fd.set("postId", deleteId);
      const result = await deletePostAction(null, fd);
      if (!result.ok) throw new Error(result.error || "Delete failed");
      toast({ title: "Post deleted", variant: "success" });
      setDeleteId(null);
      setSelected(null);
      onDeleted?.();
      void refetch();
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Failed to delete",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Reset the carousel when a different post is opened.
  useEffect(() => { setSlide(0); }, [selected?.id]);

  // Escape-to-close for the detail modal.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-1 md:gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-lg bg-surface-raised animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-10 px-4 rounded-3xl border border-rose-500/20 bg-rose-500/[0.04]">
        <p className="text-rose-400 text-sm mb-3">Couldn’t load these posts.</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="text-[var(--color-primary)] hover:underline text-xs font-bold"
        >
          Retry
        </button>
      </div>
    );
  }

  const posts = data?.items ?? [];

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={ImageIcon}
        title={isSelf ? "You haven't posted yet" : "No posts yet"}
        description={isSelf ? "Share your first moment." : "Check back soon."}
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1 md:gap-2">
        {posts.map((post, idx) => {
          const thumb = post.imageUrl
            ? getImageUrl(post.imageUrl, "grid")
            : null;
          return (
            <motion.button
              key={post.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.3) }}
              onClick={() => setSelected(post)}
              className="relative aspect-square rounded-lg md:rounded-xl overflow-hidden
                         bg-surface-raised group"
            >
              {thumb ? (
                <img
                  src={thumb}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center
                                bg-gradient-to-br from-surface to-surface-raised
                                p-3">
                  <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-5 text-center leading-tight">
                    {post.content}
                  </p>
                </div>
              )}

              {post.mediaType === "carousel" && (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md
                                 bg-black/60 backdrop-blur-sm
                                 text-white text-[9px] font-black">
                  1/{post.mediaUrls.length}
                </span>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100
                              transition-opacity flex items-center justify-center gap-4 text-white text-xs font-bold">
                <span className="flex items-center gap-1">
                  <Heart size={13} className="fill-white" /> {post.cheerCount}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle size={13} /> {post.commentCount}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md
                       flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Post detail"
              className="w-full max-w-2xl bg-surface border border-border rounded-3xl
                         overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <p className="text-xs font-bold text-muted-foreground">
                  {new Date(selected.createdAt).toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  {isSelf && (
                    <button
                      onClick={() => setDeleteId(selected.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400"
                      aria-label="Delete post"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1.5 rounded-lg hover:bg-surface-raised"
                    aria-label="Close"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {(() => {
                  const slides = selected.mediaUrls?.length
                    ? selected.mediaUrls
                    : selected.imageUrl ? [selected.imageUrl] : [];
                  if (slides.length === 0) return null;
                  const idx = Math.min(slide, slides.length - 1);
                  const alt = (selected.content || "Post media").slice(0, 80);
                  return (
                    <div className="relative bg-black">
                      <img
                        src={getImageUrl(slides[idx], "detail")}
                        alt={alt}
                        className="w-full h-auto max-h-[60vh] object-contain mx-auto"
                      />
                      {slides.length > 1 && (
                        <>
                          <button
                            type="button"
                            aria-label="Previous image"
                            onClick={(e) => { e.stopPropagation(); setSlide((s) => (s - 1 + slides.length) % slides.length); }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                          >
                            <ChevronLeft size={18} />
                          </button>
                          <button
                            type="button"
                            aria-label="Next image"
                            onClick={(e) => { e.stopPropagation(); setSlide((s) => (s + 1) % slides.length); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                          >
                            <ChevronRight size={18} />
                          </button>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold">
                            {idx + 1}/{slides.length}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
                <div className="p-5">
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                    {selected.content}
                  </p>
                  <div className="flex items-center gap-5 mt-4 pt-3 border-t border-border
                                  text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Heart size={12} /> {selected.cheerCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle size={12} /> {selected.commentCount}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Delete this post?"
        description="This will remove the post from your profile. It can't be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
