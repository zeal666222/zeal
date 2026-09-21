"use client";
// ZEAL_FIX_SERVICE_PICKER
// ═══════════════════════════════════════════════════════════════════════════════
// Service picker — tags the consultant under specific service pages
// (/services/[category]/[service]). Without tagged services, consultants
// don't appear on service detail pages.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, Save, Sparkles } from "lucide-react";

interface CatalogService { id: string; name: string; slug: string; parent_category: string }
interface CatalogGroup {
  categoryId: string; categoryName: string; sortOrder: number;
  services: CatalogService[];
}

export default function ServicesPickerPage() {
  const [groups, setGroups] = useState<CatalogGroup[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initial, setInitial] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [catRes, mineRes] = await Promise.all([
        fetch("/api/consultants/service-catalog", { cache: "no-store" }),
        fetch("/api/consultant/services", { cache: "no-store" }),
      ]);
      if (catRes.ok) {
        const d = (await catRes.json()) as { groups?: CatalogGroup[] };
        setGroups(d.groups ?? []);
      }
      if (mineRes.ok) {
        const d = (await mineRes.json()) as { services?: Array<{ Service?: { slug?: string } }> };
        const slugs = new Set<string>();
        for (const row of d.services ?? []) {
          const slug = row.Service?.slug;
          if (slug) slugs.add(slug);
        }
        setSelected(slugs);
        setInitial(new Set(slugs));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return groups;
    const q = query.toLowerCase();
    return groups
      .map((g) => ({ ...g, services: g.services.filter(
        (s) => s.name.toLowerCase().includes(q) || s.slug.includes(q),
      )}))
      .filter((g) => g.services.length > 0);
  }, [groups, query]);

  const toggle = (slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  };

  const dirty = useMemo(() => {
    if (selected.size !== initial.size) return true;
    for (const s of selected) if (!initial.has(s)) return true;
    return false;
  }, [selected, initial]);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const payload = { services: Array.from(selected).map((slug) => ({ slug })) };
      const res = await fetch("/api/consultant/services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
      }
      setInitial(new Set(selected));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
    </div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-400" /> Your Services
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Tag the services you offer. Tagged services appear on <code className="text-xs bg-slate-900 px-1.5 py-0.5 rounded">/services/[category]/[service]</code> pages.
        </p>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
        placeholder="Search services…"
        className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10 text-sm text-white placeholder:text-slate-500 outline-none focus:border-purple-500/60"
      />

      <div className="space-y-4">
        {filtered.map((group) => (
          <motion.div key={group.categoryId}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-purple-400 mb-3">
              {group.categoryName}
            </h2>
            <div className="flex flex-wrap gap-2">
              {group.services.map((s) => {
                const on = selected.has(s.slug);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.slug)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      on
                        ? "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/20"
                        : "bg-slate-950 border-white/10 text-slate-300 hover:border-purple-500/40"
                    }`}
                  >
                    {on && <Check size={11} className="inline mr-1" />}
                    {s.name}
                  </button>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold">
          {error}
        </div>
      )}

      <div className="sticky bottom-4 z-10">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-sm shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving
            ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
            : saved
              ? <><Check size={16} /> Saved</>
              : <><Save size={16} /> Save ({selected.size} selected)</>}
        </button>
      </div>
    </div>
  );
}
