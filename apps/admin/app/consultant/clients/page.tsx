"use client";

import {useEffect, useMemo, useState} from "react";
import { Calendar, Loader2, Mail, Search, Users } from "lucide-react";

interface Client {
  id: string; name: string | null; email: string | null;
  lastSessionAt: string | null; sessions: number;
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
      (c.name || "").toLowerCase().includes(ql) || (c.email || "").toLowerCase().includes(ql));
  }, [clients, q]);

  const totalSessions = clients.reduce((s, c) => s + c.sessions, 0);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-foreground">Clients</h1>
        <p className="text-sm text-muted-foreground mt-1">Your relationship history</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface backdrop-blur-xl border border-border rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Clients</p>
          <p className="text-2xl font-black font-mono mt-1 text-foreground">{clients.length}</p>
        </div>
        <div className="bg-surface backdrop-blur-xl border border-border rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Sessions</p>
          <p className="text-2xl font-black font-mono mt-1 text-purple-600 dark:text-purple-400">{totalSessions}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={q} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
          placeholder="Search clients by name or email..."
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-purple-500/50 outline-none" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-border rounded-3xl">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{q ? "No clients match your search" : "No clients yet"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="flex items-center gap-4 p-4 bg-surface backdrop-blur-xl border border-border rounded-2xl hover:border-purple-500/20 transition-all">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500/30 to-indigo-500/20 flex items-center justify-center text-foreground font-black text-sm flex-shrink-0">
                {((c.name || c.email || "?")[0] ?? "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-sm truncate">{c.name || "Anonymous"}</p>
                {c.email && (
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                    <Mail size={11} /> {c.email}
                  </p>
                )}
                {c.lastSessionAt && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Calendar size={11} /> Last session {new Date(c.lastSessionAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-black text-purple-600 dark:text-purple-400 font-mono">{c.sessions}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">sessions</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
