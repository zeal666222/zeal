"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Super Admin — Content Moderation Queue
// ═══════════════════════════════════════════════════════════════════════════════
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle, Check, Flag, Loader2, Trash2, Filter,
} from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "@/components/ui/toaster";

interface FlaggedContent {
  id: string;
  type: "post" | "comment";
  content: string;
  reporterId: string;
  targetId: string;
  reason: string;
  severity: "low" | "medium" | "high";
  createdAt: string;
}

type SeverityFilter = "all" | "low" | "medium" | "high";

export default function ModerationPage() {
  const qc = useQueryClient();
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<{ items: FlaggedContent[] }>({
    queryKey: ["admin", "moderation", severity],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (severity !== "all") params.set("severity", severity);
      const res = await fetch(`/api/admin/content?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load flagged content");
      const json = await res.json();
      return {
        items: (json.posts ?? []).map((p: Record<string, unknown>) => ({
          id: p.id as string,
          type: "post" as const,
          content: (p.content as string)?.slice(0, 200) ?? "",
          reporterId: (p.reporter as string) ?? "",
          targetId: p.id as string,
          reason: (p.reason as string) ?? "Flagged for review",
          severity: ((p.severity as "low" | "medium" | "high") ?? "medium"),
          createdAt: p.createdAt as string,
        })),
      };
    },
  });

  const moderateMutation = useMutation({
    mutationFn: async ({ action, ids }: { action: "approve" | "reject" | "delete"; ids: string[] }) => {
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Moderation action failed");
      }
      toast({ title: `${action === "approve" ? "Approved" : action === "delete" ? "Deleted" : "Rejected"} ${ids.length} item(s)` });
      return ids;
    },
    onError: (e) => {
      toast({ title: e instanceof Error ? e.message : "Moderation failed", variant: "destructive" });
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      void qc.invalidateQueries({ queryKey: ["admin", "moderation"] });
    },
  });

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const items = data?.items ?? [];
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  }, [data, selectedIds]);

  const items = data?.items ?? [];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-foreground flex items-center gap-2">
            <Flag className="w-6 h-6 text-amber-500" /> Moderation Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review flagged posts and comments. {items.length} pending.
          </p>
        </div>
      </div>

      {/* Filters + Bulk actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 p-1 bg-surface border border-border rounded-xl">
          {(["all", "low", "medium", "high"] as SeverityFilter[]).map((s) => (
            <button key={s} onClick={() => setSeverity(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                severity === s ? "bg-amber-500/15 text-amber-400" : "text-muted-foreground hover:text-foreground"
              }`}>
              {s}
            </button>
          ))}
        </div>
        {selectedIds.size > 0 && (
          <div className="flex gap-2">
            <button onClick={() => moderateMutation.mutate({ action: "approve", ids: Array.from(selectedIds) })}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold flex items-center gap-1">
              <Check size={12} /> Approve ({selectedIds.size})
            </button>
            <button onClick={() => moderateMutation.mutate({ action: "delete", ids: Array.from(selectedIds) })}
              className="px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-400 text-xs font-bold flex items-center gap-1">
              <Trash2 size={12} /> Delete ({selectedIds.size})
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-3xl text-muted-foreground">
          No flagged content. Queue is clean!
        </div>
      ) : (
        <div className="space-y-2">
          <button onClick={selectAll} className="text-xs text-muted-foreground hover:text-foreground mb-2">
            {selectedIds.size === items.length ? "Deselect all" : "Select all"}
          </button>
          {items.map((item) => (
            <div key={item.id}
              className={`flex items-start gap-3 p-4 bg-surface border rounded-2xl transition-all cursor-pointer ${
                selectedIds.has(item.id) ? "border-amber-500/40" : "border-border hover:border-amber-500/20"
              }`}
              onClick={() => toggleSelect(item.id)}>
              <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                item.severity === "high" ? "bg-rose-400" : item.severity === "medium" ? "bg-amber-400" : "bg-blue-400"
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-raised text-muted-foreground border border-border">
                    {item.type}
                  </span>
                  <span className={`text-[10px] font-bold capitalize ${
                    item.severity === "high" ? "text-rose-400" : item.severity === "medium" ? "text-amber-400" : "text-blue-400"
                  }`}>
                    {item.severity}
                  </span>
                </div>
                <p className="text-sm text-foreground line-clamp-2">{item.content || "No content"}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{item.reason} · {new Date(item.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={(e) => { e.stopPropagation(); moderateMutation.mutate({ action: "approve", ids: [item.id] }); }}
                  className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10">
                  <Check size={13} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); moderateMutation.mutate({ action: "delete", ids: [item.id] }); }}
                  className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
