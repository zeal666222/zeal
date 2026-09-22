"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, Tag } from "lucide-react";

interface Request {
  id: string;
  status: string;
  createdAt: string;
  reason: string;
}

export default function ConsultantPricingPage() {
  const qc = useQueryClient();
  const [rates, setRates] = useState({
    perMinuteRate: 50,
    chatRate: 50,
    audioRate: 75,
    videoRate: 100,
  });
  const [reason, setReason] = useState("");

  const { data } = useQuery<{ requests: Request[] }>({
    queryKey: ["consultant", "pricing-requests"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/pricing-request", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/consultant/pricing-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedRates: rates, reason }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error((e as { error?: string }).error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consultant", "pricing-requests"] });
      setReason("");
      alert("Request submitted. An admin will review it shortly.");
    },
    onError: (e: Error) => alert(e.message),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-black text-white flex items-center gap-2">
        <Tag size={22} className="text-[#9D7DC5]" /> Request Pricing Change
      </h1>

      <div className="p-5 rounded-2xl border border-white/5 bg-slate-900/60 space-y-4">
        {(["perMinuteRate", "chatRate", "audioRate", "videoRate"] as const).map((field) => (
          <div key={field}>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              {field.replace(/([A-Z])/g, " $1").trim()} (₹)
            </label>
            <input
              type="number" min={10} max={5000}
              value={rates[field]}
              onChange={(e) => setRates({ ...rates, [field]: Number(e.target.value) })}
              className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-white font-mono outline-none focus:border-[#9D7DC5]"
            />
          </div>
        ))}

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
            Reason (min 30 chars)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm text-white resize-none outline-none focus:border-[#9D7DC5]"
          />
          <p className="text-[10px] text-slate-500 mt-1">{reason.length}/30 minimum</p>
        </div>

        <button
          disabled={reason.length < 30 || submit.isPending}
          onClick={() => submit.mutate()}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2">
          {submit.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Submit Request
        </button>
      </div>

      <div className="p-5 rounded-2xl border border-white/5 bg-slate-900/60">
        <h2 className="text-sm font-black text-white uppercase tracking-wider mb-3">Your Requests</h2>
        {(data?.requests ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No requests yet.</p>
        ) : (
          (data?.requests ?? []).map((r) => (
            <div key={r.id} className="p-3 rounded-xl bg-slate-950/60 mb-2">
              <div className="flex justify-between text-xs">
                <span className={`font-bold ${
                  r.status === "APPROVED" ? "text-emerald-400"
                  : r.status === "REJECTED" ? "text-rose-400"
                  : "text-amber-400"
                }`}>{r.status}</span>
                <span className="text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1 italic">&ldquo;{r.reason}&rdquo;</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
