"use client";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {motion} from "framer-motion";
import {Flag, Check, X, Eye, Loader2, ExternalLink} from "lucide-react";

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "content", "reports"] }),
  });

  const items = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#9D7DC5]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card-3d p-6 text-center text-red-500">
        <p>Failed to load reports: {(error as Error).message}</p>
        <button onClick={() => refetch()} className="mt-2 text-[#9D7DC5] hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-white flex items-center gap-2">
          <Flag className="w-6 h-6 text-[#9D7DC5]" /> Content Moderation
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {items.length} flagged post{items.length !== 1 ? "s" : ""} awaiting review
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
          <Flag className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">All caught up — no flagged content</p>
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
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
                  {post.author?.avatar
                    ? <img src={post.author.avatar} alt="" className="w-full h-full object-cover" />
                    : (post.author?.name || post.author?.username || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">
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
                  className="text-xs text-[#9D7DC5] hover:underline flex items-center gap-1"
                >
                  View <ExternalLink size={11} />
                </a>
              </div>

              <p className="text-sm text-slate-300 whitespace-pre-wrap break-words line-clamp-4 mb-3">
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

              <div className="flex gap-2 pt-3 border-t border-white/5">
                <button
                  onClick={() => actionMutation.mutate({ postId: post.id, action: "dismiss" })}
                  disabled={actionMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-bold disabled:opacity-50"
                >
                  <Check size={14} /> Dismiss report
                </button>
                <button
                  onClick={() => {
                    if (!confirm("Delete this post permanently?")) return;
                    actionMutation.mutate({ postId: post.id, action: "delete" });
                  }}
                  disabled={actionMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-sm font-bold disabled:opacity-50"
                >
                  <X size={14} /> Delete post
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
