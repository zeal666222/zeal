"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Admin Live Sessions — realtime monitor of ongoing billed sessions
// ═══════════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Radio, Loader2, IndianRupee, Clock, User, Sparkles } from "lucide-react";

interface LiveSession {
  id: string;
  userId: string;
  userName: string | null;
  consultantId: string | null;
  consultantName: string | null;
  isAI: boolean;
  startTime: string;
  durationSeconds: number;
  amount: number;
  rate: number;
}

export default function LiveSessionsPage() {
  const [items, setItems] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sessions/live", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items?: LiveSession[] };
      setItems(data.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => { void load(); }, 15_000);
    return () => clearInterval(interval);
  }, [load]);

  const totalLive = items.length;
  const totalBurn = items.reduce((s, it) => s + it.rate, 0);
  const totalAccrued = items.reduce((s, it) => s + (it.durationSeconds / 60) * it.rate, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-white flex items-center gap-2">
          <Radio className="w-6 h-6 text-emerald-400 animate-pulse" /> Live Sessions
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Realtime monitor of ongoing billed sessions · refresh every 15s
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KPI label="Live Now" value={totalLive} accent="text-emerald-400" />
        <KPI label="Burn Rate" value={`₹${totalBurn.toFixed(0)}/min`} accent="text-purple-400" />
        <KPI label="Accrued" value={`₹${totalAccrued.toFixed(0)}`} accent="text-amber-400" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
      ) : error ? (
        <div className="text-center py-16 text-rose-400">
          {error}
          <button onClick={load} className="ml-2 underline">Retry</button>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-white/5 rounded-3xl">
          <Radio className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No live sessions right now</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => {
            const elapsedMin = Math.floor(s.durationSeconds / 60);
            const accrued = (s.durationSeconds / 60) * s.rate;
            return (
              <div key={s.id} className="p-4 bg-slate-900/60 border border-emerald-500/20 rounded-2xl">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      {s.isAI ? <Sparkles size={16} className="text-emerald-400" /> : <User size={16} className="text-emerald-400" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-white text-sm truncate">
                        {s.userName ?? "User"} → {s.consultantName ?? "AI"}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Clock size={11} /> {elapsedMin} min</span>
                        <span className="flex items-center gap-1 text-purple-400 font-mono font-bold">
                          <IndianRupee size={11} /> {s.rate}/min
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black font-mono text-emerald-400">₹{accrued.toFixed(2)}</p>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">accrued</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function KPI({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="p-4 bg-slate-900/60 border border-white/5 rounded-2xl">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`text-2xl font-black font-mono mt-1 ${accent}`}>{value}</p>
    </div>
  );
}
