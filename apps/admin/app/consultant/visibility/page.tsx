"use client";
// ZEAL_FIX_CONSULTANT_VISIBILITY
// ═══════════════════════════════════════════════════════════════════════════════
// Consultant self-audit page — verifies their profile is live everywhere.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Check, ExternalLink, Eye, Loader2, RefreshCw, ShieldCheck, Sparkles,
  X } from "lucide-react";

interface Report {
  success: boolean;
  error?: string;
  user?: {
    id: string; email: string; role: string;
    is_online: boolean; lastSeenAt: string | null;
  };
  consultant?: {
    id: string; status: string; isActive: boolean; isVerified: boolean;
    subdomainActive: boolean; subdomain: string | null;
    category: string; bio_length: number; perMinuteRate: number;
    specialties_count: number; languages_count: number;
    rating: number; sparkScore: number;
  };
  checks?: Record<string, boolean>;
  service_count?: number;
  public_url?: string | null;
  profile_url?: string | null;
}

const CHECK_LABEL: Record<string, string> = {
  role_is_client_admin:     "User role is CLIENT_ADMIN",
  consultant_verified:      "Consultant status VERIFIED",
  consultant_active:        "Consultant is active",
  consultant_verified_flag: "Verified flag set",
  in_directory_mv:          "Present in public directory",
  has_services:             "At least one service selected",
  has_bio:                  "Bio is 20+ characters",
  has_specialties:          "Specialties configured",
  has_subdomain:            "White-label subdomain assigned",
};

export default function ConsultantVisibilityPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/consultant/visibility", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Report;
      if (!data.success) throw new Error(data.error ?? "Unknown error");
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>;
  }

  if (error || !report) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-black text-white">Visibility Audit</h1>
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error ?? "Unable to load report"}
        </div>
        <button onClick={load} className="px-5 py-3 rounded-xl bg-purple-600 text-white text-sm font-bold flex items-center gap-2">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const checks = report.checks ?? {};
  const passing = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;
  const allPass = passing === total;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-white flex items-center gap-2">
            <Eye className="w-6 h-6 text-purple-400" /> Visibility Audit
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Confirms your profile is live on the homepage, explore directory, and services pages.
          </p>
        </div>
        <button
          onClick={load}
          className="shrink-0 p-3 rounded-xl bg-slate-900/60 border border-white/5 hover:border-purple-500/40 text-slate-300"
          aria-label="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Summary banner */}
      <div className={`p-5 rounded-3xl border-2 ${
        allPass
          ? "bg-emerald-500/5 border-emerald-500/30"
          : "bg-amber-500/5 border-amber-500/30"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl ${
            allPass ? "bg-emerald-500/15" : "bg-amber-500/15"
          }`}>
            {allPass
              ? <ShieldCheck size={24} className="text-emerald-400" />
              : <AlertCircle size={24} className="text-amber-400" />}
          </div>
          <div>
            <p className={`text-lg font-black ${allPass ? "text-emerald-400" : "text-amber-400"}`}>
              {allPass ? "Fully visible" : `${passing}/${total} checks passing`}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {allPass
                ? "Your profile appears on every public surface."
                : "Fix the failing checks below to increase visibility."}
            </p>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="rounded-3xl border border-white/5 bg-slate-900/40 p-5 space-y-2">
        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">
          Visibility Checks
        </h2>
        {Object.entries(checks).map(([key, ok]) => (
          <div
            key={key}
            className={`flex items-center gap-3 p-3 rounded-xl ${
              ok ? "bg-emerald-500/5" : "bg-rose-500/5"
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              ok ? "bg-emerald-500/20" : "bg-rose-500/20"
            }`}>
              {ok
                ? <Check size={13} className="text-emerald-400" />
                : <X size={13} className="text-rose-400" />}
            </div>
            <span className={`text-sm ${ok ? "text-slate-300" : "text-slate-200 font-bold"}`}>
              {CHECK_LABEL[key] ?? key}
            </span>
          </div>
        ))}
      </div>

      {/* Quick facts */}
      {report.consultant && (
        <div className="rounded-3xl border border-white/5 bg-slate-900/40 p-5">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">
            Profile Snapshot
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <Stat label="Category"      value={report.consultant.category} />
            <Stat label="Rate"          value={`₹${report.consultant.perMinuteRate}/min`} />
            <Stat label="Rating"        value={report.consultant.rating.toFixed(1)} />
            <Stat label="Sparks"        value={report.consultant.sparkScore.toLocaleString()} />
            <Stat label="Services"      value={String(report.service_count ?? 0)} />
            <Stat label="Bio length"    value={`${report.consultant.bio_length} chars`} />
            <Stat label="Specialties"   value={String(report.consultant.specialties_count)} />
            <Stat label="Languages"     value={String(report.consultant.languages_count)} />
            <Stat label="Online"        value={report.user?.is_online ? "yes" : "no"} />
          </div>
        </div>
      )}

      {/* Public URLs */}
      <div className="rounded-3xl border border-white/5 bg-slate-900/40 p-5 space-y-3">
        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">
          Public URLs
        </h2>
        {report.profile_url && (
          <URLRow label="Public profile" url={report.profile_url} />
        )}
        {report.public_url && (
          <URLRow label="White-label site" url={report.public_url} absolute />
        )}
      </div>

      {/* Guidance */}
      {!allPass && (
        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-2">
          <p className="text-sm font-bold text-amber-400 flex items-center gap-2">
            <Sparkles size={14} /> How to fix
          </p>
          <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
            {!checks.has_services && <li>Tag services on <a href="/consultant/services" className="text-purple-400 underline">/consultant/services</a></li>}
            {!checks.has_bio && <li>Write a 20+ character bio in <a href="/consultant/settings" className="text-purple-400 underline">/consultant/settings</a></li>}
            {!checks.has_specialties && <li>Add at least one specialty in settings</li>}
            {!checks.in_directory_mv && <li>Your row exists but hasn&apos;t been indexed — refresh the page in 30 seconds (auto-heals)</li>}
            {!checks.role_is_client_admin && <li>Role promotion pending — try refreshing your session (re-login)</li>}
            {!checks.has_subdomain && <li>Subdomain is auto-assigned — check settings</li>}
          </ul>
        </div>
      )}
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-slate-950/50">
      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{label}</p>
      <p className="text-sm text-white font-mono mt-0.5 truncate">{value}</p>
    </div>
  );
}

function URLRow({ label, url, absolute }: { label: string; url: string; absolute?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{label}</p>
        <p className="text-xs font-mono text-white truncate">{url}</p>
      </div>
      <button onClick={handleCopy} className="p-2 rounded-lg hover:bg-white/5 text-purple-400 text-xs font-bold">
        {copied ? "Copied" : "Copy"}
      </button>
      <a href={absolute ? url : url} target="_blank" rel="noopener noreferrer"
         className="p-2 rounded-lg hover:bg-white/5 text-purple-400" aria-label="Open">
        <ExternalLink size={13} />
      </a>
    </div>
  );
}
