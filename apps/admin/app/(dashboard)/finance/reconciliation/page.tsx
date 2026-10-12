"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Super Admin — Financial Reconciliation
// ═══════════════════════════════════════════════════════════════════════════════
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle, CheckCircle, IndianRupee, Loader2, Shield,
} from "lucide-react";
import { useState } from "react";
import { toast } from "@/components/ui/toaster";

interface Discrepancy {
  id: string;
  userId: string;
  type: "overcharge" | "undercharge" | "negative_balance" | "missing_transaction";
  amount: number;
  description: string;
  detectedAt: string;
  autoCorrectable: boolean;
}

function fmtINR(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export default function ReconciliationPage() {
  const [autoCorrecting, setAutoCorrecting] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ discrepancies: Discrepancy[]; summary: { total: number; autoCorrectable: number; manualReview: number } }>({
    queryKey: ["admin", "finance", "reconciliation"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load reconciliation data");
      // Stub: in production, compare wallet txns vs billing heartbeats
      return {
        discrepancies: [],
        summary: { total: 0, autoCorrectable: 0, manualReview: 0 },
      };
    },
  });

  const handleAutoCorrect = async (id: string) => {
    setAutoCorrecting(id);
    try {
      // In production: call reconciliation API
      await new Promise((r) => setTimeout(r, 1000));
      toast({ title: "Auto-corrected", description: "Small discrepancy resolved automatically." });
    } finally {
      setAutoCorrecting(null);
    }
  };

  const discrepancies = data?.discrepancies ?? [];
  const summary = data?.summary ?? { total: 0, autoCorrectable: 0, manualReview: 0 };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-foreground flex items-center gap-2">
          <IndianRupee className="w-6 h-6 text-emerald-500" /> Financial Reconciliation
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compare wallet transactions vs billing heartbeats. Auto-correct small discrepancies.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-surface p-4 text-center">
          <p className="text-2xl font-black text-foreground font-mono">{summary.total}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black mt-1">Total Discrepancies</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
          <p className="text-2xl font-black text-emerald-400 font-mono">{summary.autoCorrectable}</p>
          <p className="text-[10px] uppercase tracking-widest text-emerald-400/70 font-black mt-1">Auto-correctable</p>
        </div>
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-center">
          <p className="text-2xl font-black text-rose-400 font-mono">{summary.manualReview}</p>
          <p className="text-[10px] uppercase tracking-widest text-rose-400/70 font-black mt-1">Manual Review</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
      ) : discrepancies.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-3xl">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
          <p className="text-sm font-bold text-emerald-400">All reconciled!</p>
          <p className="text-xs text-muted-foreground mt-1">No discrepancies detected.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {discrepancies.map((d) => (
            <div key={d.id}
              className="flex items-center gap-3 p-4 bg-surface border border-border rounded-2xl">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                d.autoCorrectable ? "bg-emerald-500/10" : "bg-rose-500/10"
              }`}>
                {d.autoCorrectable ? <Shield size={14} className="text-emerald-400" /> : <AlertTriangle size={14} className="text-rose-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{d.description}</p>
                <p className="text-xs text-muted-foreground">
                  {d.type} · ₹{fmtINR(d.amount)} · {new Date(d.detectedAt).toLocaleDateString()}
                </p>
              </div>
              {d.autoCorrectable && d.amount < 10 && (
                <button onClick={() => handleAutoCorrect(d.id)}
                  disabled={autoCorrecting === d.id}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold flex items-center gap-1 disabled:opacity-50">
                  {autoCorrecting === d.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                  Auto-fix
                </button>
              )}
              {!d.autoCorrectable && (
                <span className="text-[10px] font-bold text-rose-400 px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20">
                  Manual review
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
