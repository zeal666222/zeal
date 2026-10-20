"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Admin Verification Queue — realtime applicant review
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";
import { motion } from "framer-motion";
import { Check, Loader2, Shield, X } from "lucide-react";
import { EmptyState } from "@zeal/ui";
import { toast } from "@/components/ui/toaster";

interface PendingConsultant {
  id: string;
  status: string;
  category: string;
  specialties: string[] | null;
  bio?: string | null;
  perMinuteRate: number;
  createdAt: string;
  verificationDocs: string[] | null;
  user: {
    id: string;
    name?: string | null;
    email: string;
    username: string;
    avatar?: string | null;
  };
}

export default function AdminVerificationPage() {
  const qc = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery<{ consultants: PendingConsultant[] }>({
    queryKey: ["admin", "verification"],
    queryFn: async () => {
      const res = await fetch("/api/admin/verification", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (consultantId: string) => {
      const res = await fetch("/api/admin/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultantId, action: "APPROVE" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Approval rejected (${res.status})`);
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "verification"] });
      toast({
        title: "Consultant verified",
        description: "They can now take paid bookings and appear in search.",
        variant: "success",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Could not verify", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ consultantId, reason }: { consultantId: string; reason: string }) => {
      const res = await fetch("/api/admin/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultantId, action: "REJECT", reason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Rejection failed (${res.status})`);
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "verification"] });
      setRejectingId(null);
      setReason("");
      toast({
        title: "Application rejected",
        description: "The consultant sees your reason and can reapply.",
        variant: "success",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Could not reject", description: err.message, variant: "destructive" });
    },
  });

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["admin", "verification"] });
  }, [qc]);

  useChannel<BroadcastChange>({
    channel: channels.adminVerification(),
    event: "*",
    onMessage: refresh,
  });

  const pending: PendingConsultant[] = data?.consultants || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-[var(--color-foreground)] flex items-center gap-2">
          <Shield className="w-6 h-6 text-[var(--color-primary)]" /> Verification Queue
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)] mt-1">
          {pending.length} applicant{pending.length !== 1 ? "s" : ""} awaiting review
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-2xl bg-[var(--color-surface-raised)] animate-pulse" />
          ))}
        </div>
      ) : pending.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="All caught up"
          description="No pending verifications at this time."
        />
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {pending.map((c, idx) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-[var(--color-primary-muted)] flex items-center justify-center text-[var(--color-primary)] font-black shrink-0 overflow-hidden">
                  {c.user.avatar ? (
                    <img src={c.user.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (c.user.name || c.user.username).charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[var(--color-foreground)]">
                    {c.user.name || `@${c.user.username}`}
                  </p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">{c.user.email}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-primary-muted)] text-[var(--color-primary)] font-bold">
                      {c.category}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-raised)] text-[var(--color-foreground)]">
                      ₹{c.perMinuteRate}/min
                    </span>
                    <span className="text-[10px] text-[var(--color-muted-foreground)]">
                      Applied {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {c.bio && (
                <p className="text-sm text-[var(--color-foreground)] mb-3 line-clamp-3">{c.bio}</p>
              )}

              {/* The route returns verificationDocs — show them, or say plainly that
                  there is nothing to review, so approval is never a blind act. */}
              <div className="mb-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1.5">
                  Submitted documents
                </p>
                {Array.isArray(c.verificationDocs) && c.verificationDocs.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(c.verificationDocs as unknown[]).map((raw, i) => {
                      // JSONB column: legacy rows hold URL strings, newer ones may hold
                      // {url} objects. Only a real string can become an href.
                      const url = typeof raw === "string" ? raw
                        : (raw && typeof raw === "object" && typeof (raw as {url?: unknown}).url === "string")
                          ? (raw as {url: string}).url : null;
                      if (!url || !/^https?:\/\//i.test(url)) return null;
                      return (
                        <a
                          key={`${url}-${i}`}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-primary)] hover:underline break-all"
                        >
                          Document {i + 1}
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-500">
                    No documents were submitted with this application. Confirm identity through the
                    chat history or a live session before approving.
                  </p>
                )}
              </div>

              {c.specialties && c.specialties.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {c.specialties.map((s) => (
                    <span
                      key={s}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-muted-foreground)]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {rejectingId === c.id ? (
                <div className="space-y-2">
                  <textarea
                    value={reason}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                    placeholder="Reason for rejection…"
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-sm text-[var(--color-foreground)] resize-none outline-none focus:border-[var(--color-primary)]"
                  />
                  <p className={`text-[11px] ${reason.trim().length < 10 ? "text-amber-500" : "text-emerald-500"}`}>
                    {reason.trim().length < 10
                      ? `Give the consultant something actionable — ${10 - reason.trim().length} more characters needed.`
                      : "Reason looks specific enough to act on."}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setRejectingId(null); setReason(""); }}
                      className="flex-1 py-2 rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-foreground)] text-sm font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate({ consultantId: c.id, reason })}
                      disabled={rejectMutation.isPending || reason.trim().length < 10}
                      className="flex-1 py-2 rounded-xl bg-rose-500 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {rejectMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                      Confirm Reject
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => approveMutation.mutate(c.id)}
                    disabled={approveMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold disabled:opacity-50"
                  >
                    {approveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check className="w-4 h-4" />}
                    Approve
                  </button>
                  <button
                    onClick={() => setRejectingId(c.id)}
                    className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-rose-500/10 text-rose-500 text-sm font-bold"
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
