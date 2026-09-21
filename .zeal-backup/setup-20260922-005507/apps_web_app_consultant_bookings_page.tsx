"use client";

import {useEffect, useMemo, useState} from "react";
import Link from "next/link";
import { Calendar, Clock, Filter, IndianRupee, Loader2, Search, User } from "lucide-react";

interface Booking {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  amount: number;
  userName: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  CONFIRMED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  IN_PROGRESS: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  COMPLETED: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  CANCELLED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

type Filter = "all" | "PENDING" | "CONFIRMED" | "COMPLETED";

export default function ConsultantBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/consultant/bookings")
      .then((r) => (r.ok ? r.json() : { bookings: [] }))
      .then((d) => setBookings(d.bookings ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (filter !== "all" && b.status !== filter) return false;
      if (q && !(b.userName || "").toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [bookings, filter, q]);

  const stats = useMemo(() => ({
    total: bookings.length,
    pending: bookings.filter((b) => b.status === "PENDING").length,
    confirmed: bookings.filter((b) => b.status === "CONFIRMED").length,
    completed: bookings.filter((b) => b.status === "COMPLETED").length,
  }), [bookings]);

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
        <h1 className="text-2xl lg:text-3xl font-black text-white">Bookings</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your incoming and upcoming sessions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "Pending", value: stats.pending, color: "text-amber-400" },
          { label: "Confirmed", value: stats.confirmed, color: "text-emerald-400" },
          { label: "Completed", value: stats.completed, color: "text-slate-400" },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{s.label}</p>
            <p className={`text-2xl font-black font-mono mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
            placeholder="Search by client name..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-white/5 rounded-xl text-sm text-white placeholder:text-slate-500 outline-none focus:border-purple-500/50"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "PENDING", "CONFIRMED", "COMPLETED"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                filter === f
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/20"
                  : "bg-slate-900/60 border border-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">{bookings.length === 0 ? "No bookings yet" : "No bookings match your filters"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <Link
              key={b.id}
              href={`/chat/${b.id}`}
              className="block p-4 lg:p-5 bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl hover:border-purple-500/40 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 flex-shrink-0">
                    <User size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm truncate">{b.userName || "Seeker"}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {new Date(b.scheduledAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {b.durationMinutes}m
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-purple-400 font-bold text-sm flex items-center gap-1 justify-end">
                    <IndianRupee size={12} /> {b.amount}
                  </p>
                  <span className={`inline-block mt-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                    STATUS_STYLE[b.status] || STATUS_STYLE.COMPLETED
                  }`}>
                    {b.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
