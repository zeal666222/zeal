"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Super Admin — API Key Management
// ═══════════════════════════════════════════════════════════════════════════════
import { toast } from "@/components/ui/toaster";
import { useState, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Key, Plus, Trash2, Copy, Check, Loader2, Shield, AlertTriangle, X,
} from "lucide-react";

interface APIKey {
  id: string;
  name: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  keyPrefix: string;
}

// Mirrors VALID_SCOPES in /api/admin/api-keys. These are capabilities an endpoint
// actually checks, so a key can only be issued for work it can perform.
const ALL_SCOPES = [
  { value: "wallet:credit", label: "Credit user wallets" },
  { value: "wallet:debit", label: "Debit user wallets" },
  { value: "withdraw:process", label: "Approve or reject withdrawals" },
  { value: "impersonate:session", label: "Impersonate a user or AI consultant" },
  { value: "read-only", label: "Read-only dashboards (no actions)" },
] as const;

export default function APIKeysPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [expiresDays, setExpiresDays] = useState<number | null>(30);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error: loadError } = useQuery<{ keys: APIKey[] }>({
    queryKey: ["admin", "api-keys"],
    queryFn: async () => {
      const res = await fetch("/api/admin/api-keys", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to load API keys");
      }
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName,
          scopes: selectedScopes,
          expiresDays,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to create key");
      }
      return res.json() as Promise<{ key: string; success: boolean }>;
    },
    onSuccess: (data) => {
      setGeneratedKey(data.key);
      void qc.invalidateQueries({ queryKey: ["admin", "api-keys"] });
      toast({ title: "API key created", description: "Copy it now — it won't be shown again." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke key");
      return res.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "api-keys"] });
      toast({ title: "API key revoked" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleScope = useCallback((scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }, []);

  const handleCreate = () => {
    if (!newKeyName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (selectedScopes.length === 0) {
      toast({ title: "Select at least one scope", variant: "destructive" });
      return;
    }
    createMutation.mutate();
  };

  const handleCopy = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetCreate = () => {
    setShowCreate(false);
    setNewKeyName("");
    setSelectedScopes([]);
    setExpiresDays(30);
    setGeneratedKey(null);
  };

  const keys = data?.keys ?? [];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-foreground flex items-center gap-2">
            <Key className="w-6 h-6 text-amber-500" /> API Keys
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Programmatic access for CI/CD, external tools, and integrations.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-xs font-bold hover:opacity-90 flex items-center gap-1.5">
          <Plus size={14} /> New Key
        </button>
      </div>

      {/* ─── Key list ──────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        </div>
      ) : loadError ? (
        // An empty list and a failed list look identical otherwise, and the
        // honest reason here is usually an unapplied schema change.
        <div className="p-4 border-2 border-rose-500/30 bg-rose-500/5 rounded-2xl text-sm">
          <p className="font-bold text-rose-400 mb-1">Could not load keys</p>
          <p className="text-muted-foreground">{(loadError as Error).message}</p>
          <button onClick={() => qc.invalidateQueries({ queryKey: ["admin", "api-keys"] })}
            className="mt-3 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-bold text-foreground">
            Retry
          </button>
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-3xl text-muted-foreground">
          No API keys yet. Create one to enable programmatic access.
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id}
              className="flex items-center gap-3 p-4 bg-surface border border-border rounded-2xl hover:border-amber-500/30 transition-all">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Key size={16} className="text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{k.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground">{k.keyPrefix}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {k.lastUsedAt ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"}
                  </span>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-1 flex-wrap">
                {k.scopes.slice(0, 3).map((s) => (
                  <span key={s} className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-raised text-muted-foreground border border-border">
                    {s}
                  </span>
                ))}
                {k.scopes.length > 3 && (
                  <span className="text-[9px] text-muted-foreground">+{k.scopes.length - 3}</span>
                )}
              </div>
              <div className="text-right">
                {k.expiresAt ? (
                  <span className={`text-[10px] font-bold ${
                    new Date(k.expiresAt) < new Date() ? "text-rose-400" : "text-muted-foreground"
                  }`}>
                    Expires {new Date(k.expiresAt).toLocaleDateString()}
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-400 font-bold">No expiry</span>
                )}
              </div>
              <button onClick={() => revokeMutation.mutate(k.id)}
                disabled={revokeMutation.isPending}
                className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ─── Create modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={resetCreate}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-surface border border-border rounded-3xl p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              {generatedKey ? (
                /* ─── Key generated — show once ───────────────────────────── */
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertTriangle size={18} />
                    <h3 className="text-lg font-black">Store this key securely</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This key will only be shown once. Copy it now.
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-surface-raised border border-border rounded-xl">
                    <code className="flex-1 text-xs font-mono text-foreground break-all select-all">
                      {generatedKey}
                    </code>
                    <button onClick={() => handleCopy(generatedKey)}
                      className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground">
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <button onClick={resetCreate}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-bold">
                    Done
                  </button>
                </div>
              ) : (
                /* ─── Create form ─────────────────────────────────────────── */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-foreground">Generate API Key</h3>
                    <button onClick={resetCreate} className="p-1 rounded-lg hover:bg-white/5">
                      <X size={16} className="text-muted-foreground" />
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</label>
                    <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., Production Deploy Key"
                      className="w-full mt-1 px-3 py-2.5 bg-surface-raised border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-amber-500/50" />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Scopes</label>
                    <div className="mt-1 grid grid-cols-2 gap-1.5">
                      {ALL_SCOPES.map((s) => (
                        <button key={s.value} onClick={() => toggleScope(s.value)}
                          className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                            selectedScopes.includes(s.value)
                              ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                              : "bg-surface-raised border-border text-muted-foreground hover:border-amber-500/20"
                          }`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Expires in</label>
                    <div className="flex gap-2 mt-1">
                      {[7, 30, 90, 0].map((d) => (
                        <button key={d} onClick={() => setExpiresDays(d || null)}
                          className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                            expiresDays === (d || null)
                              ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                              : "bg-surface-raised border-border text-muted-foreground"
                          }`}>
                          {d === 0 ? "Never" : `${d}d`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button onClick={handleCreate}
                    disabled={createMutation.isPending}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                    {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                    Generate Key
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
