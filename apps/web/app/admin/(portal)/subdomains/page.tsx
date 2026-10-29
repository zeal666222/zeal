"use client";

import { useEffect, useState } from "react";
import {
  Globe, Loader2, Check, Copy, ExternalLink, Power,
  Search, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
} from "lucide-react";

interface ConsultantRow {
  id: string;
  subdomain: string | null;
  subdomainActive: boolean;
  whiteLabelEnabled: boolean;
  userName: string | null;
  userEmail: string | null;
  pageUrl: string | null;
}

export default function AdminSubdomainsPage() {
  const [loading, setLoading] = useState(true);
  const [consultants, setConsultants] = useState<ConsultantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Provision modal
  const [showProvision, setShowProvision] = useState(false);
  const [provisionConsultantId, setProvisionConsultantId] = useState("");
  const [provisionSubdomain, setProvisionSubdomain] = useState("");
  const [provisionError, setProvisionError] = useState<string | null>(null);

  const fetchConsultants = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/subdomains", { cache: "no-store" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to fetch");
      }
      const d = await res.json();
      setConsultants(d.consultants ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConsultants(); }, []);

  const copyUrl = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* ignore */ }
  };

  const toggleSubdomain = async (consultantId: string) => {
    setActionLoading(consultantId);
    try {
      const res = await fetch("/api/admin/subdomains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultantId, subdomain: "", action: "toggle" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to toggle");
      }
      await fetchConsultants();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const revokeSubdomain = async (consultantId: string) => {
    if (!confirm("Revoke this subdomain? The landing page will go offline.")) return;
    setActionLoading(consultantId);
    try {
      const res = await fetch("/api/admin/subdomains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultantId, subdomain: "", action: "revoke" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to revoke");
      }
      await fetchConsultants();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const doProvision = async () => {
    setProvisionError(null);
    if (!provisionConsultantId || !provisionSubdomain.trim()) {
      setProvisionError("Select a consultant and enter a subdomain");
      return;
    }
    if (!/^[a-z0-9]+$/.test(provisionSubdomain)) {
      setProvisionError("Only lowercase letters and numbers");
      return;
    }
    setActionLoading("provision");
    try {
      const res = await fetch("/api/admin/subdomains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultantId: provisionConsultantId,
          subdomain: provisionSubdomain.trim().toLowerCase(),
          action: "provision",
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to provision");
      }
      setShowProvision(false);
      setProvisionSubdomain("");
      setProvisionConsultantId("");
      await fetchConsultants();
    } catch (e) {
      setProvisionError(e instanceof Error ? e.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = consultants.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.userName?.toLowerCase().includes(q) ||
      c.userEmail?.toLowerCase().includes(q) ||
      c.subdomain?.toLowerCase().includes(q) ||
      false
    );
  });

  const withSubdomain = consultants.filter((c) => c.subdomain).length;
  const active = consultants.filter((c) => c.subdomainActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-foreground flex items-center gap-3">
            <Globe className="w-7 h-7 text-purple-500" />
            Subdomain Manager
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Provision and manage consultant landing pages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchConsultants}
            className="px-3 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            onClick={() => setShowProvision(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-black hover:opacity-90 transition-all flex items-center gap-1.5"
          >
            <Globe size={12} /> Provision New
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-surface border border-border">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Total Consultants</p>
          <p className="text-2xl font-black text-foreground mt-1">{consultants.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-surface border border-border">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">With Subdomain</p>
          <p className="text-2xl font-black text-purple-500 mt-1">{withSubdomain}</p>
        </div>
        <div className="p-4 rounded-2xl bg-surface border border-border">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Active Pages</p>
          <p className="text-2xl font-black text-emerald-500 mt-1">{active}</p>
        </div>
        <div className="p-4 rounded-2xl bg-surface border border-border">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Coverage</p>
          <p className="text-2xl font-black text-amber-500 mt-1">
            {consultants.length > 0 ? Math.round((withSubdomain / consultants.length) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or subdomain..."
          className="w-full pl-11 pr-4 py-3 bg-surface border border-border rounded-2xl text-sm text-foreground focus:border-purple-500 outline-none"
        />
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-bold flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Consultant</th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Subdomain</th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Status</th>
                  <th className="text-right px-4 py-3 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-surface-raised/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-bold text-foreground">{c.userName || "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground">{c.userEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      {c.subdomain ? (
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-1 rounded-lg">
                            {c.subdomain}.zealer.co.in
                          </code>
                          <button
                            onClick={() => copyUrl(`https://${c.subdomain}.zealer.co.in`, c.id)}
                            className="p-1 rounded hover:bg-surface-overlay text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {copied === c.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Not assigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.subdomain ? (
                        c.subdomainActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                            <CheckCircle2 size={10} /> Live
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                            <XCircle size={10} /> Paused
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {c.subdomain && (
                          <>
                            <a
                              href={c.pageUrl ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg hover:bg-surface-overlay text-muted-foreground hover:text-foreground transition-colors"
                              title="View page"
                            >
                              <ExternalLink size={14} />
                            </a>
                            <button
                              onClick={() => toggleSubdomain(c.id)}
                              disabled={actionLoading === c.id}
                              className="p-2 rounded-lg hover:bg-surface-overlay text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                              title={c.subdomainActive ? "Pause" : "Activate"}
                            >
                              {actionLoading === c.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Power size={14} className={c.subdomainActive ? "text-emerald-400" : "text-amber-400"} />
                              )}
                            </button>
                            <button
                              onClick={() => revokeSubdomain(c.id)}
                              disabled={actionLoading === c.id}
                              className="p-2 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-colors disabled:opacity-50"
                              title="Revoke subdomain"
                            >
                              <XCircle size={14} />
                            </button>
                          </>
                        )}
                        {!c.subdomain && (
                          <button
                            onClick={() => {
                              setProvisionConsultantId(c.id);
                              setShowProvision(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs font-bold text-purple-400 hover:bg-purple-500/20 transition-colors"
                          >
                            Assign
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No consultants found
            </div>
          )}
        </div>
      )}

      {/* Provision modal */}
      {showProvision && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-surface border border-border">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                <Globe size={20} className="text-purple-500" />
                Provision Subdomain
              </h3>
              <button
                onClick={() => { setShowProvision(false); setProvisionError(null); }}
                className="p-2 rounded-lg hover:bg-surface-overlay"
              >
                <XCircle size={18} className="text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                  Select Consultant
                </label>
                <select
                  value={provisionConsultantId}
                  onChange={(e) => setProvisionConsultantId(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-raised border border-border rounded-2xl text-sm text-foreground outline-none focus:border-purple-500"
                >
                  <option value="">Choose consultant...</option>
                  {consultants.filter((c) => !c.subdomain).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.userName || c.userEmail}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                  Subdomain
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={provisionSubdomain}
                    onChange={(e) => setProvisionSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                    className="flex-1 px-4 py-3 bg-surface-raised border border-border rounded-2xl text-sm text-foreground font-mono outline-none focus:border-purple-500"
                    placeholder="mysite"
                    maxLength={30}
                  />
                  <span className="text-sm text-muted-foreground font-mono">.zealer.co.in</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Lowercase letters and numbers only</p>
              </div>

              {provisionError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold">
                  {provisionError}
                </div>
              )}

              <button
                onClick={doProvision}
                disabled={actionLoading === "provision" || !provisionConsultantId || !provisionSubdomain.trim()}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-black hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
              >
                {actionLoading === "provision" ? (
                  <><Loader2 size={15} className="animate-spin" /> Provisioning...</>
                ) : (
                  <><Globe size={15} /> Provision Subdomain</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
