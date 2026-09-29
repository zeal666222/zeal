"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Admin Withdrawals — approve/reject with payout reference
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, CreditCard, Loader2, X } from "lucide-react";
import { ConfirmDialog } from "@zeal/ui";
import { toast } from "@/components/ui/toaster";
import { EmptyState } from "@/components/shared/EmptyState";

interface Withdrawal {
  id: string;
  amount: number;
  description: string;
  createdAt: string;
  metadata?: { upiId?: string; bankAccount?: string; reference?: string } | null;
  wallet: {
    user: {
      id: string;
      name?: string | null;
      email: string;
      username: string;
    };
  };
}

export default function AdminWithdrawalsPage() {
  const qc = useQueryClient();
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    action: "APPROVE" | "REJECT";
    email: string;
  } | null>(null);

  const { data, isLoading } = useQuery<{ withdrawals?: Withdrawal[] }>({
    queryKey: ["admin", "withdrawals"],
    queryFn: async () => {
      const res = await fetch("/api/admin/withdrawals");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ transactionId, action }: { transactionId: string; action: "APPROVE" | "REJECT" }) => {
      const res = await fetch("/api/admin/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, action }),
      });
      if (!res.ok) throw new Error("Action failed");
      return res.json();
    },
    onSuccess: (_d, { action }) => {
      toast({ title: action === "APPROVE" ? "Withdrawal approved" : "Withdrawal rejected", variant: "success" });
      void qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const withdrawals = data?.withdrawals ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
        <CreditCard className="w-6 h-6 text-[var(--color-primary)]" /> Withdrawals
      </h1>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : withdrawals.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No pending withdrawals"
          description="All payouts are up to date."
        />
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {withdrawals.map((w, idx) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="rounded-2xl border border-border bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="font-bold text-foreground truncate">
                    {w.wallet.user.name ?? `@${w.wallet.user.username}`}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {w.wallet.user.email}
                  </p>
                </div>
                <p className="text-lg font-black font-mono text-[var(--color-primary)] shrink-0">
                  ₹{Math.abs(w.amount).toFixed(2)}
                </p>
              </div>

              {w.metadata?.upiId && (
                <p className="text-xs text-muted-foreground mb-1">
                  UPI: <span className="text-foreground font-mono">{w.metadata.upiId}</span>
                </p>
              )}

              <p className="text-[10px] text-muted-foreground mb-3">
                Requested {new Date(w.createdAt).toLocaleString()}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setPendingAction({
                    id: w.id,
                    action: "APPROVE",
                    email: w.wallet.user.email,
                  })}
                  disabled={actionMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl
                             bg-gradient-to-r from-emerald-600 to-teal-600
                             text-white text-sm font-black
                             disabled:opacity-50 transition-all active:scale-95"
                >
                  <Check className="w-4 h-4" /> Approve
                </button>
                <button
                  onClick={() => setPendingAction({
                    id: w.id,
                    action: "REJECT",
                    email: w.wallet.user.email,
                  })}
                  disabled={actionMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl
                             bg-rose-500/10 text-rose-400 text-sm font-black
                             disabled:opacity-50 transition-all active:scale-95"
                >
                  <X className="w-4 h-4" /> Reject
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(open) => { if (!open) setPendingAction(null); }}
        title={pendingAction?.action === "APPROVE"
          ? `Approve withdrawal for ${pendingAction?.email}?`
          : `Reject withdrawal for ${pendingAction?.email}?`}
        description={pendingAction?.action === "APPROVE"
          ? "Funds will be marked as paid out. Ensure the transfer is complete before approving."
          : "Funds will be returned to the consultant's available balance."}
        confirmLabel={pendingAction?.action === "APPROVE" ? "Approve payout" : "Reject payout"}
        destructive={pendingAction?.action === "REJECT"}
        loading={actionMutation.isPending}
        onConfirm={async () => {
          if (!pendingAction) return;
          try {
            await actionMutation.mutateAsync({
              transactionId: pendingAction.id,
              action: pendingAction.action,
            });
            setPendingAction(null);
          } catch { /* toast handled */ }
        }}
      />
    </div>
  );
}
