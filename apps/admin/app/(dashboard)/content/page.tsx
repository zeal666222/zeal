"use client";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useState} from "react";
import {motion} from "framer-motion";
import { ConfirmDialog } from "@zeal/ui";
import { toast } from "@/components/ui/toaster";
import { Check, ExternalLink, Eye, Flag, Loader2, X } from "lucide-react";

interface FlaggedPost {
  id: string;
  content: string;
  mediaUrls: string[] | null;
  createdAt: string;
  author: { id: string; name: string | null; username: string; avatar: string | null } | null;
}

interface ContentResponse {
  items?: FlaggedPost[];
}

export default function AdminContentPage() {
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery<ContentResponse>({
    queryKey: ["admin", "content", "reports"],
    queryFn: async () => {
      const res = await fetch("/api/admin/content/reports", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ postId, action }: { postId: string; action: "dismiss" | "delete" }) => {
      const res = await fetch("/api/admin/content/reports", {
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
    onSuccess: (_data, { action }) => {
      qc.invalidateQueries({ queryKey: ["admin", "content", "reports"] });
      toast({ title: action === "delete" ? "Post deleted" : "Report dismissed", variant: "success" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const items = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card-3d p-6 text-center text-red-500">
        <p>Failed to load reports: {(error as Error).message}</p>
        <button onClick={() => refetch()} className="mt-2 text-[var(--color-primary)] hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-foreground flex items-center gap-2">
          <Flag className="w-6 h-6 text-[var(--color-primary)]" /> Content Moderation
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {items.length} flagged post{items.length !== 1 ? "s" : ""} awaiting review
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-border rounded-3xl">
          <Flag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">All caught up — no flagged content</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {items.map((post, idx) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.04, 0.3) }}
              className="glass-card-3d p-5"
            >
              <div className="flex items-start gap-4 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
                  {post.author?.avatar
                    ? <img src={post.author.avatar} alt="" className="w-full h-full object-cover" />
                    : (post.author?.name || post.author?.username || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground truncate">
                    {post.author?.name || post.author?.username || "Unknown author"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(post.createdAt).toLocaleString()}
                  </p>
                </div>
                <a
                  href={`https://zeal-web-red.vercel.app/post/${post.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1"
                >
                  View <ExternalLink size={11} />
                </a>
              </div>

              <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words line-clamp-4 mb-3">
                {post.content}
              </p>

              {post.mediaUrls && post.mediaUrls.length > 0 && (
                <div className="grid grid-cols-4 gap-1 mb-3">
                  {post.mediaUrls.slice(0, 4).map((url, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden bg-slate-800">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t border-border">
                <button
                  onClick={() => actionMutation.mutate({ postId: post.id, action: "dismiss" })}
                  disabled={actionMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold disabled:opacity-50"
                >
                  <Check size={14} /> Dismiss report
                </button>
                <button
                  onClick={() => setDeleteId(post.id)}
                  disabled={actionMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-bold disabled:opacity-50"
                >
                  <X size={14} /> Delete post
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Delete this post permanently?"
        description="The post will be removed for everyone. This cannot be undone."
        confirmLabel="Delete post"
        destructive
        loading={actionMutation.isPending}
        onConfirm={async () => {
          if (deleteId) {
            try {
              await actionMutation.mutateAsync({ postId: deleteId, action: "delete" });
              setDeleteId(null);
            } catch { /* toast handled by mutation */ }
          }
        }}
      />
    </div>
  );
}
