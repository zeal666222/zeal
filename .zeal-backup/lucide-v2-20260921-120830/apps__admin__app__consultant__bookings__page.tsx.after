"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Consultant Bookings — filters, inline accept/decline, realtime
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Calendar, Check, Clock, IndianRupee, Loader2, MessageCircle, Search,
  User, X } from "lucide-react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";

interface Booking {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  amount: number;
  userName: string | null;
}

interface ProfileRes { user?: { id: string } }

const STATUS_STYLE: Record<string, string> = {
  PENDING:     "bg-amber-500/10 text-amber-500 border-amber-500/20",
  CONFIRMED:   "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  IN_PROGRESS: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  COMPLETED:   "bg-[var(--color-surface-raised)] text-[var(--color-muted-foreground)] border-[var(--color-border)]",
  CANCELLED:   "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

type Filter = "all" | "PENDING" | "CONFIRMED" | "COMPLETED";

function friendlyError(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = String(raw).toLowerCase();
  if (s.includes("unauthorized") || s.includes("401")) return "Please sign in again.";
  if (s.includes("conflict") || s.includes("409")) return "This booking was already actioned.";
  if (s.includes("rate limit") || s.includes("429")) return "Slow down a moment, then retry.";
  if (s.includes("network") || s.includes("fetch")) return "Connection hiccup. Try again.";
  return "Something didn't go through. Please try again.";
}

export default function ConsultantBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/consultant/bookings", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as { bookings?: Booking[] };
      setBookings(d.bookings ?? []);
      setError(null);
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : "load failed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    fetch("/api/users/me/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ProfileRes | null) => { if (d?.user?.id) setUserId(d.user.id); })
      .catch(() => {});
  }, []);

  // Realtime
  useChannel<BroadcastChange<unknown>>({
    channel: userId ? channels.consultantBookings(userId) : null,
    event: "*",
    onMessage: useCallback(() => { void load(); }, [load]),
  });
  useChannel<BroadcastChange<unknown>>({
    channel: channels.adminBookings(),
    event: "*",
    onMessage: useCallback(() => { void load(); }, [load]),
  });

  const action = useCallback(
    async (bookingId: string, kind: "accept" | "decline") => {
      setBusyId(bookingId);
      setError(null);
      try {
        const url = kind === "accept"
          ? `/api/bookings/${bookingId}/confirm`
          : `/api/bookings/${bookingId}/cancel`;
        const res = await fetch(url, { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
        }
        await load();
      } catch (e) {
        setError(friendlyError(e instanceof Error ? e.message : "action failed"));
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const filtered = useMemo(
    () =>
      bookings.filter((b) => {
        if (filter !== "all" && b.status !== filter) return false;
        if (q && !(b.userName || "").toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [bookings, filter, q],
  );

  const stats = useMemo(
    () => ({
      total: bookings.length,
      pending: bookings.filter((b) => b.status === "PENDING").length,
      confirmed: bookings.filter((b) => b.status === "CONFIRMED").length,
      completed: bookings.filter((b) => b.status === "COMPLETED").length,
    }),
    [bookings],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-[var(--color-foreground)]">Bookings</h1>
        <p className="text-sm text-[var(--color-muted-foreground)] mt-1">Accept, decline, and track every session</p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: "Total",     v: stats.total,     c: "text-[var(--color-foreground)]" },
          { l: "Pending",   v: stats.pending,   c: "text-amber-500" },
          { l: "Confirmed", v: stats.confirmed, c: "text-emerald-500" },
          { l: "Completed", v: stats.completed, c: "text-[var(--color-muted-foreground)]" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-muted-foreground)]">{s.l}</p>
            <p className={"text-2xl font-black font-mono mt-1 " + s.c}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
          <input
            value={q}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
            placeholder="Search by client name…"
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-subtle-foreground)] outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "PENDING", "CONFIRMED", "COMPLETED"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={"px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all " + (
                filter === f
                  ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-primary-foreground)] shadow-lg"
                  : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              )}
            >
              {f === "all" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-[var(--color-border)] rounded-3xl">
          <Calendar className="w-12 h-12 text-[var(--color-muted-foreground)] mx-auto mb-4" />
          <p className="text-[var(--color-muted-foreground)]">
            {bookings.length === 0 ? "No bookings yet" : "No bookings match your filters"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => {
            const busy = busyId === b.id;
            const isPending = b.status === "PENDING";
            return (
              <div
                key={b.id}
                className="p-4 lg:p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/40 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-[var(--color-primary-muted)] flex items-center justify-center text-[var(--color-primary)] shrink-0">
                      <User size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[var(--color-foreground)] text-sm truncate">{b.userName || "Seeker"}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-muted-foreground)]">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} /> {new Date(b.scheduledAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {b.durationMinutes}m
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[var(--color-primary)] font-bold text-sm flex items-center gap-1 justify-end font-mono">
                      <IndianRupee size={12} /> {b.amount}
                    </p>
                    <span className={"inline-block mt-1 text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full border " + (STATUS_STYLE[b.status] || STATUS_STYLE.COMPLETED)}>
                      {b.status}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex flex-wrap gap-2">
                  {isPending ? (
                    <>
                      <button
                        onClick={() => action(b.id, "accept")}
                        disabled={busy}
                        className="flex-1 min-w-[120px] py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Accept
                      </button>
                      <button
                        onClick={() => action(b.id, "decline")}
                        disabled={busy}
                        className="flex-1 min-w-[120px] py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-500 text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                        Decline
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/consultant/chat"
                        className="flex-1 min-w-[120px] py-2.5 rounded-xl bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-overlay)] text-[var(--color-foreground)] text-xs font-black flex items-center justify-center gap-1.5"
                      >
                        <MessageCircle size={12} /> Open Chat
                      </Link>
                      <Link
                        href="/consultant/clients"
                        className="flex-1 min-w-[120px] py-2.5 rounded-xl bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-overlay)] text-[var(--color-foreground)] text-xs font-black flex items-center justify-center gap-1.5"
                      >
                        <User size={12} /> Client Profile
                      </Link>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
