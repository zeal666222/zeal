"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Audit Log Viewer — searchable, realtime
// ═══════════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ScrollText, Loader2, Search } from "lucide-react";

interface AuditRow {
  id: string;
  createdAt: string;
  action_name: string | null;
  userId: string | null;
  email: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  success: boolean | null;
}

export default function AuditPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<{ items: AuditRow[] }>({
    queryKey: ["admin", "audit"],
    queryFn: async () => {
      const res = await fetch("/api/admin/audit?limit=200", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const items = (data?.items ?? []).filter((r) =>
    !search ||
    (r.action_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (r.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (r.targetType ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-white flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-[#9D7DC5]" /> Audit Log
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {items.length} event{items.length !== 1 ? "s" : ""} (latest 200)
        </p>
      </div>

      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by action, actor, target..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-white/5 rounded-xl text-sm text-white placeholder:text-slate-500 outline-none focus:border-[#9D7DC5]" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#9D7DC5]" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-white/5 rounded-3xl text-slate-500">
          No audit events yet
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-900/40">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.02] border-b border-white/5">
              <tr>
                {["Time", "Action", "Actor", "Target", "Status"].map((h) => (
                  <th key={h} className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-white/[0.02]">
                  <td className="p-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3 text-xs font-bold text-white">{row.action_name ?? "—"}</td>
                  <td className="p-3 text-xs text-slate-300 truncate max-w-[200px]">
                    {row.email ?? row.userId?.slice(0, 8) ?? "system"}
                  </td>
                  <td className="p-3 text-xs text-slate-300">
                    {row.targetType ?? "—"}{row.targetId ? `#${row.targetId.slice(0, 8)}` : ""}
                  </td>
                  <td className="p-3">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      row.success === false
                        ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                        : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    }`}>
                      {row.success === false ? "FAIL" : "OK"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
