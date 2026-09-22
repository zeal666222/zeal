"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Loader2, Tag, X } from "lucide-react";

interface RateMap { [k: string]: number }

interface Request {
  id: string;
  status: string;
  reason: string;
  currentRates: RateMap;
  requestedRates: RateMap;
  createdAt: string;
  consultant: {
    id: string;
    category: string;
    user: { name: string | null; email: string; avatar_url?: string | null };
  };
}

export default function PricingRequestsPage() {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery<{ requests: Request[] }>({
    queryKey: ["admin", "pricing-requests"],
    queryFn: async () => {
      const res = await fetch("/api/admin/pricing-requests?status=PENDING", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: "APPROVE" | "REJECT"; reason?: string }) => {
      const res = await fetch("/api/admin/pricing-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id, action, reason }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error((e as { error?: string }).error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "pricing-requests"] });
      setRejecting(null);
      setReason("");
    },
  });

  const requests = data?.requests ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Tag size={22} className="text-[#9D7DC5]" /> Pricing Requests
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Consultants submit rate changes. Only SUPER_ADMIN can approve.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#9D7DC5]" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl text-slate-400">
          No pending pricing requests
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <motion.div key={r.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl border border-white/5 bg-slate-900/60">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-white">{r.consultant.user.name ?? r.consultant.user.email}</p>
                  <p className="text-xs text-slate-500">{r.consultant.category}</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                  {r.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {Object.keys(r.requestedRates).map((key) => (
                  <div key={key} className="p-3 rounded-xl bg-slate-950/60">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{key}</p>
                    <p className="text-slate-500 line-through text-xs">₹{r.currentRates[key] ?? "—"}</p>
                    <p className="text-white font-mono font-bold">₹{r.requestedRates[key]}</p>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs text-slate-400 italic">&ldquo;{r.reason}&rdquo;</p>

              {rejecting === r.id ? (
                <div className="mt-4 space-y-2">
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="Reason for rejection (min 10 chars)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-sm text-white resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => { setRejecting(null); setReason(""); }}
                      className="flex-1 py-2 rounded-xl bg-white/5 text-slate-300 text-sm font-bold">
                      Cancel
                    </button>
                    <button
                      disabled={reason.length < 10 || decide.isPending}
                      onClick={() => decide.mutate({ id: r.id, action: "REJECT", reason })}
                      className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold disabled:opacity-50">
                      Confirm Reject
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => decide.mutate({ id: r.id, action: "APPROVE" })}
                    disabled={decide.isPending}
                    className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold disabled:opacity-50">
                    <Check size={14} /> Approve
                  </button>
                  <button
                    onClick={() => setRejecting(r.id)}
                    className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-rose-500/10 text-rose-400 text-sm font-bold">
                    <X size={14} /> Reject
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
