"use client";

import {useEffect, useState} from "react";
import { Check, Loader2, Plus, Save, Trash2 } from "lucide-react";

const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const;
type Day = typeof DAYS[number];
type Block = { start: string; end: string };
type Availability = Record<Day, Block[]>;

const EMPTY: Availability = {
  monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [],
};

export default function AvailabilityPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability>(EMPTY);
  const [bufferMinutes, setBufferMinutes] = useState(10);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/consultant/availability", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.availability && typeof data.availability === "object") {
            setAvailability({ ...EMPTY, ...data.availability });
          }
          if (typeof data.bufferMinutes === "number") setBufferMinutes(data.bufferMinutes);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const add = (d: Day) => setAvailability({ ...availability, [d]: [...availability[d], { start: "09:00", end: "12:00" }] });
  const rm = (d: Day, i: number) => setAvailability({ ...availability, [d]: availability[d].filter((_, idx) => idx !== i) });
  const upd = (d: Day, i: number, key: "start" | "end", v: string) => {
    const next = availability[d].map((b, idx) => (idx === i ? { ...b, [key]: v } : b));
    setAvailability({ ...availability, [d]: next });
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/consultant/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability, bufferMinutes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Save failed");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Network error");
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-foreground">Weekly Schedule</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure when seekers can book you.</p>
      </div>

      <div className="bg-surface backdrop-blur-xl border border-border rounded-3xl p-5 lg:p-6 space-y-4">
        {DAYS.map((d) => (
          <div key={d} className="p-4 bg-surface-raised/50 rounded-2xl border border-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-foreground capitalize">{d}</p>
              <button onClick={() => add(d)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-500/20">
                <Plus size={11} /> Add
              </button>
            </div>
            {availability[d].length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Unavailable</p>
            ) : (
              <div className="space-y-2">
                {availability[d].map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="time" value={b.start} onChange={(e: React.ChangeEvent<HTMLInputElement>) => upd(d, i, "start", e.target.value)}
                      className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-foreground font-mono" />
                    <span className="text-muted-foreground text-xs">to</span>
                    <input type="time" value={b.end} onChange={(e: React.ChangeEvent<HTMLInputElement>) => upd(d, i, "end", e.target.value)}
                      className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-foreground font-mono" />
                    <button onClick={() => rm(d, i)} className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-600 dark:text-rose-400">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="pt-4 border-t border-border">
          <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Buffer between sessions</label>
          <select value={bufferMinutes} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBufferMinutes(Number(e.target.value))}
            className="px-4 py-2.5 bg-surface-raised border border-border rounded-xl text-sm text-foreground outline-none focus:border-indigo-500">
            {[5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n} minutes</option>)}
          </select>
        </div>

        {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">{error}</div>}

        <button onClick={save} disabled={saving}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-black hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> :
           saved  ? <><Check size={15} /> Saved</> :
                    <><Save size={15} /> Save changes</>}
        </button>
      </div>
    </div>
  );
}
