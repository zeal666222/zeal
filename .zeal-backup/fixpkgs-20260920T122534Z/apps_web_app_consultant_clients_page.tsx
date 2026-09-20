"use client";

import {useEffect, useMemo, useState} from "react";
import {Users, Loader2, Search, Mail, Calendar} from "lucide-react";

interface Client {
  id: string;
  name: string | null;
  email: string | null;
  lastSessionAt: string | null;
  sessions: number;
}

export default function ConsultantClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/consultant/clients")
      .then((r) => (r.ok ? r.json() : { clients: [] }))
      .then((d) => setClients(d.clients ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    if (!ql) return clients;
    return clients.filter((c) =>
      (c.name || "").toLowerCase().includes(ql) ||
      (c.email || "").toLowerCase().includes(ql)
    );
  }, [clients, q]);

  const totalSessions = clients.reduce((s, c) => s + c.sessions, 0);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-white">Clients</h1>
        <p className="text-sm text-slate-400 mt-1">Your relationship history</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Clients</p>
          <p className="text-2xl font-black font-mono mt-1 text-white">{clients.length}</p>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Sessions</p>
          <p className="text-2xl font-black font-mono mt-1 text-purple-400">{totalSessions}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search clients by name or email..."
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/60 border border-white/5 text-sm text-white placeholder:text-slate-500 focus:border-purple-500/50 outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">{q ? "No clients match your search" : "No clients yet"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-4 p-4 bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl hover:border-purple-500/20 transition-all"
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500/30 to-indigo-500/20 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                {((c.name || c.email || "?")[0] ?? "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm truncate">{c.name || "Anonymous"}</p>
                {c.email && (
                  <p className="text-xs text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                    <Mail size={11} /> {c.email}
                  </p>
                )}
                {c.lastSessionAt && (
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <Calendar size={11} /> Last session {new Date(c.lastSessionAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-black text-purple-400 font-mono">{c.sessions}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">sessions</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
