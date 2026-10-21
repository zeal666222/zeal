"use client";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useEffect, useMemo, useState} from "react";
import {motion} from "framer-motion";
import { ConfirmDialog } from "@zeal/ui";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";
import { toast } from "@/components/ui/toaster";
import {
  Archive, ArchiveRestore, Check, ChevronLeft, ChevronRight, Edit3,
  ExternalLink, Flag, Loader2, Search, X,
} from "lucide-react";

interface AdminPost {
  id: string;
  content: string;
  mediaUrls: string[] | null;
  isFlagged: boolean;
  isArchived: boolean;
  cheerCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string | null; username: string; avatar: string | null } | null;
}

interface PostsResponse {
  items?: AdminPost[];
  total?: number;
  page?: number;
  pages?: number;
}

type Tab = "posts" | "flagged";

export default function AdminContentPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("posts");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const postsQuery = useQuery<PostsResponse>({
    queryKey: ["admin", "content", "posts", tab, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ filter: tab === "flagged" ? "flagged" : "all", page: String(page) });
      if (search) params.set("q", search);
      const res = await fetch(`/api/admin/content/posts?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "content"] });
  };

  const postAction = useMutation({
    mutationFn: async ({ postId, action }: { postId: string; action: "dismiss" | "archive" | "restore" | "delete" }) => {
      const res = action === "delete"
        ? await fetch("/api/admin/content/posts", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postId }),
          })
        : await fetch("/api/admin/content/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postId, action }),
          });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Action failed");
      }
      return res.json();
    },
    onSuccess: (_d, { action }) => {
      refreshAll();
      toast({
        title: action === "delete" ? "Post deleted" : action === "dismiss" ? "Report dismissed" : action === "archive" ? "Post archived" : "Post restored",
        variant: "success",
      });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const editPost = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const res = await fetch("/api/admin/content/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, content }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Edit failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setEditId(null);
      refreshAll();
      toast({ title: "Post updated", variant: "success" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  // ContentReport writes and Post.isFlagged flips both publish admin:moderation,
  // so a new report appears in the queue without a reload — and a second admin
  // dismissing it removes the row from here before this tab acts on it.
  useChannel<BroadcastChange>({
    channel: channels.adminModeration(),
    event: "*",
    onMessage: refreshAll,
  });

  const items = useMemo(() => postsQuery.data?.items ?? [], [postsQuery.data]);
  const total = postsQuery.data?.total ?? 0;
  const pages = postsQuery.data?.pages ?? 1;
  const isPending = postAction.isPending || editPost.isPending;

  const startEdit = (post: AdminPost) => {
    setEditId(post.id);
    setEditText(post.content);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-foreground flex items-center gap-2">
            <Flag className="w-6 h-6 text-[var(--color-primary)]" /> Content Moderation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tab === "flagged"
              ? `${total} flagged post${total !== 1 ? "s" : ""} awaiting review`
              : `${total} active post${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex gap-2">
          {(["posts", "flagged"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                tab === t
                  ? "bg-[var(--color-primary)] text-white shadow-lg shadow-rose-500/20"
                  : "glass-card-3d text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "posts" ? "All Posts" : "Flagged"}
            </button>
          ))}
        </div>
      </div>

      {tab === "posts" && (
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search post text or author…"
            className="w-full glass-card-3d rounded-2xl pl-11 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
          />
        </div>
      )}

      {postsQuery.isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : postsQuery.error ? (
        <div className="glass-card-3d p-6 text-center text-red-500">
          <p>Failed to load posts: {(postsQuery.error as Error).message}</p>
          <button onClick={() => postsQuery.refetch()} className="mt-2 text-[var(--color-primary)] hover:underline">Retry</button>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-border rounded-3xl">
          <Flag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {tab === "flagged"
              ? search ? "No flagged posts match your search" : "All caught up — no flagged content"
              : search ? "No posts match your search" : "No active posts yet"}
          </p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {items.map((post, idx) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.3) }}
              className="glass-card-3d p-5"
            >
              <div className="flex items-start gap-4 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
                  {post.author?.avatar
                    ? <img src={post.author.avatar} alt="" className="w-full h-full object-cover" />
                    : (post.author?.name || post.author?.username || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-foreground truncate">
                      {post.author?.name || post.author?.username || "Unknown author"}
                    </p>
                    {post.isFlagged && (
                      <span className="px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-400 text-[9px] font-black border border-rose-500/20 flex items-center gap-1">
                        <Flag size={9} /> FLAGGED
                      </span>
                    )}
                    {post.isArchived && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-[9px] font-black border border-amber-500/20">
                        ARCHIVED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {new Date(post.createdAt).toLocaleString()} · {post.cheerCount} cheers · {post.commentCount} comments
                  </p>
                </div>
                <a
                  href={`/post/${post.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1 flex-shrink-0"
                >
                  View <ExternalLink size={11} />
                </a>
              </div>

              {editId === post.id ? (
                <div className="space-y-2 mb-3">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={4}
                    maxLength={5000}
                    className="w-full glass-card-3d rounded-xl p-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 resize-y"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setEditId(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:bg-surface-raised"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => editPost.mutate({ postId: post.id, content: editText })}
                      disabled={!editText.trim() || editPost.isPending}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--color-primary)] text-white disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {editPost.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words line-clamp-4 mb-3">
                  {post.content}
                </p>
              )}

              {post.mediaUrls && post.mediaUrls.length > 0 && (
                <div className="grid grid-cols-4 gap-1 mb-3">
                  {post.mediaUrls.slice(0, 4).map((url, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden bg-slate-800">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                {editId !== post.id && (
                  <button
                    onClick={() => startEdit(post)}
                    disabled={isPending}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 text-sm font-bold disabled:opacity-50"
                  >
                    <Edit3 size={14} /> Edit
                  </button>
                )}
                {post.isFlagged && (
                  <button
                    onClick={() => postAction.mutate({ postId: post.id, action: "dismiss" })}
                    disabled={isPending}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold disabled:opacity-50"
                  >
                    <Check size={14} /> Dismiss report
                  </button>
                )}
                {post.isArchived ? (
                  <button
                    onClick={() => postAction.mutate({ postId: post.id, action: "restore" })}
                    disabled={isPending}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-sm font-bold disabled:opacity-50"
                  >
                    <ArchiveRestore size={14} /> Restore
                  </button>
                ) : (
                  <button
                    onClick={() => postAction.mutate({ postId: post.id, action: "archive" })}
                    disabled={isPending}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-sm font-bold disabled:opacity-50"
                  >
                    <Archive size={14} /> Archive
                  </button>
                )}
                <button
                  onClick={() => setDeleteId(post.id)}
                  disabled={isPending}
                  className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-bold disabled:opacity-50"
                >
                  <X size={14} /> Delete
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-xl glass-card-3d text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs text-muted-foreground font-bold">Page {page} of {pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages}
            className="p-2 rounded-xl glass-card-3d text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Delete this post permanently?"
        description="The post will be removed for everyone. This cannot be undone."
        confirmLabel="Delete post"
        destructive
        loading={postAction.isPending}
        onConfirm={async () => {
          if (deleteId) {
            try {
              await postAction.mutateAsync({ postId: deleteId, action: "delete" });
              setDeleteId(null);
            } catch { /* toast handled by mutation */ }
          }
        }}
      />
    </div>
  );
}

