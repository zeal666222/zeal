"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Admin AI Consultants — list · create · edit · deactivate
// ═══════════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Edit3, Loader2, Plus, Save, Search, Sparkles, Trash2, Wifi, X } from "lucide-react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";

interface AiConsultant {
  id: string;
  name: string;
  username: string;
  avatar: string;
  category: string;
  bio: string;
  persona: string | null;
  systemPrompt: string | null;
  isPaid: boolean;
  perMinuteRate: number;
  rating: number;
  isActive: boolean;
  isFeatured: boolean;
  specialties: string[];
  languages: string[];
}

const EMPTY_FORM: Omit<AiConsultant, "id" | "username" | "rating"> = {
  name: "", avatar: "", category: "ASTROLOGER", bio: "",
  persona: null, systemPrompt: null, isPaid: false, perMinuteRate: 0,
  isActive: true, isFeatured: false, specialties: [], languages: ["English"],
};

export default function AdminAiConsultantsPage() {
  const [items, setItems] = useState<AiConsultant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/admin/ai-consultants", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useChannel<BroadcastChange<AiConsultant>>({
    channel: channels.consultantAiUpdates(),
    event: "*",
    onMessage: (payload) => {
      const type = payload?.type;
      const record = payload?.record;
      const old = payload?.old_record;
      if (type === "INSERT" && record) {
        setItems((prev) => prev.some((x) => x.id === record.id) ? prev : [record, ...prev]);
      } else if (type === "UPDATE" && record) {
        setItems((prev) => prev.map((x) => x.id === record.id ? record : x));
      } else if (type === "DELETE" && old?.id) {
        setItems((prev) => prev.filter((x) => x.id !== old.id));
      }
    },
  });

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const startEdit = (c: AiConsultant) => {
    setEditingId(c.id);
    setForm({
      name: c.name, avatar: c.avatar, category: c.category, bio: c.bio,
      persona: c.persona, systemPrompt: c.systemPrompt, isPaid: c.isPaid,
      perMinuteRate: c.perMinuteRate, isActive: c.isActive, isFeatured: c.isFeatured,
      specialties: c.specialties, languages: c.languages,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name || !form.avatar || !form.bio) {
      alert("Name, avatar URL, and bio are required.");
      return;
    }
    setSaving(true);
    try {
      const url = editingId
        ? `/api/admin/ai-consultants/${editingId}`
        : `/api/admin/ai-consultants`;
      const method = editingId ? "PUT" : "POST";
      const payload = editingId
        ? form
        : { ...form, systemPrompt: form.systemPrompt || `You are ${form.name}, an expert ${form.category} consultant on Zeal. Speak with warmth, authority, and practical insight.` };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Save failed");
      }
      setShowForm(false);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  };

  const deactivate = async (id: string) => {
    if (!confirm("Deactivate this AI consultant? Conversation history is preserved.")) return;
    try {
      const res = await fetch(`/api/admin/ai-consultants/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Deactivate failed");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    }
  };

  const filtered = items.filter((c) =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-[#9D7DC5]" /> AI Consultants
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">{items.length} profiles</span>
          <button onClick={startCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white text-sm font-bold">
            <Plus size={14} /> Create New
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input type="text" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          placeholder="Search by name or category..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-slate-900/60 text-sm text-white placeholder:text-slate-500 outline-none focus:border-[#9D7DC5]" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#9D7DC5]" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-rose-400">
          Failed to load: {error}
          <button onClick={load} className="ml-2 text-[#9D7DC5] hover:underline">Retry</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="glass-card-3d p-4">
              <div className="flex items-center gap-3">
                <img src={c.avatar} alt={c.name} className="w-12 h-12 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{c.name}</p>
                  <p className="text-xs text-slate-400 capitalize">{c.category.toLowerCase()}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${
                  c.isActive ? "bg-green-500/20 text-green-400" : "bg-slate-500/20 text-slate-400"
                }`}>{c.isActive ? "Active" : "Inactive"}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-yellow-400">⭐ {c.rating.toFixed(1)}</span>
                <span className="text-[#9D7DC5]">{c.isPaid ? `₹${c.perMinuteRate}/min` : "Free"}</span>
                {c.isFeatured && <span className="text-amber-400 text-[10px]">Featured</span>}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => startEdit(c)}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold">
                  <Edit3 size={11} /> Edit
                </button>
                {c.isActive && (
                  <button onClick={() => deactivate(c.id)}
                    className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold">
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowForm(false)}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-black text-white">
                  {editingId ? "Edit AI Consultant" : "Create AI Consultant"}
                </h2>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-white/5">
                  <X size={16} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                {(["name", "avatar", "category"] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      {field}
                    </label>
                    <input type="text" value={form[field] as string}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-[#9D7DC5]" />
                  </div>
                ))}

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Bio
                  </label>
                  <textarea value={form.bio} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, bio: e.target.value })}
                    rows={3} className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-[#9D7DC5] resize-none" />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    System Prompt
                  </label>
                  <textarea value={form.systemPrompt ?? ""} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, systemPrompt: e.target.value })}
                    rows={4} placeholder="Leave blank for default persona"
                    className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-xs text-white font-mono outline-none focus:border-[#9D7DC5] resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Rate (₹/min)
                    </label>
                    <input type="number" min={0} max={500} value={form.perMinuteRate}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, perMinuteRate: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm text-white font-mono outline-none focus:border-[#9D7DC5]" />
                  </div>
                  <div className="space-y-2 pt-6">
                    <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                      <input type="checkbox" checked={form.isPaid}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, isPaid: e.target.checked })}
                        className="rounded" />
                      Paid
                    </label>
                    <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                      <input type="checkbox" checked={form.isFeatured}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, isFeatured: e.target.checked })}
                        className="rounded" />
                      Featured
                    </label>
                  </div>
                </div>

                <button onClick={save} disabled={saving}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> :
                   editingId ? <><Save size={16} /> Save Changes</> :
                   <><Plus size={16} /> Create AI Consultant</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
