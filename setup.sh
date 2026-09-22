#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — Fix all type-check + build errors
# ═══════════════════════════════════════════════════════════════════════════════
# Fixes:
#   1. Rewrite apps/admin/app/consultant/settings/page.tsx (all state + imports)
#   2. Fix apps/web/lib/chat/offline-store.ts ('last' possibly undefined)
#   3. Verify weights with awk (no paste/bc dependency)
#   4. Install dependencies (lz-string)
#   5. Type-check + build both apps
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]:-$0}"
REPO_ROOT="$(cd "$(dirname "$SCRIPT_PATH")" >/dev/null 2>&1 && pwd)"
cd "$REPO_ROOT"

if [[ ! -f package.json ]]; then
  echo "✗ Run from repo root"; exit 1
fi

if [[ -t 1 ]]; then
  G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[1;34m'; N='\033[0m'
else
  G=''; Y=''; R=''; B=''; N=''
fi
ok()   { printf "${G}  ✓${N} %s\n" "$*"; }
warn() { printf "${Y}  ○${N} %s\n" "$*"; }
fail() { printf "${R}  ✗${N} %s\n" "$*"; }
head_() { printf "\n${B}▸ %s${N}\n" "$*"; }

TS=$(date +%Y%m%d-%H%M%S)
BK=".zeal-backup/fix-errors-$TS"
mkdir -p "$BK"
backup() { [[ -f "$1" ]] && { mkdir -p "$BK/$(dirname "$1")"; cp "$1" "$BK/$1"; }; }

# ═══════════════════════════════════════════════════════════════════════════════
head_ "PHASE 1 — Rewrite apps/admin/app/consultant/settings/page.tsx"
# ═══════════════════════════════════════════════════════════════════════════════

SETTINGS="apps/admin/app/consultant/settings/page.tsx"
backup "$SETTINGS"

cat > "$SETTINGS" <<'TSX_EOF'
"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Save, IndianRupee, X } from "lucide-react";

interface ServiceGroup {
  categoryId: string;
  categoryName: string;
  sortOrder: number;
  services: {
    id: string;
    name: string;
    slug: string;
    parent_category: string;
  }[];
}

export default function ConsultantSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [bio, setBio] = useState("");
  const [rate, setRate] = useState(50);
  const [specialties, setSpecialties] = useState("");
  const [languages, setLanguages] = useState("");
  const [subdomain, setSubdomain] = useState<string | null>(null);

  const [category, setCategory] = useState("");
  const [catalog, setCatalog] = useState<ServiceGroup[]>([]);
  const [selectedServiceSlugs, setSelectedServiceSlugs] = useState<string[]>([]);
  const [initialServiceSlugs, setInitialServiceSlugs] = useState<string[]>([]);

  const [showPricingRequest, setShowPricingRequest] = useState(false);
  const [requestRates, setRequestRates] = useState({
    perMinuteRate: 50,
    chatRate: 50,
    audioRate: 75,
    videoRate: 100,
  });
  const [requestReason, setRequestReason] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [pulseRes, catalogRes, servicesRes] = await Promise.all([
          fetch("/api/consultant/pulse", { cache: "no-store" }),
          fetch("/api/consultants/service-catalog", { cache: "no-store" }),
          fetch("/api/consultant/services", { cache: "no-store" }),
        ]);

        if (pulseRes.ok) {
          const data = await pulseRes.json();
          const c = data?.consultant;
          if (c) {
            setBio(c.bio ?? "");
            setRate(c.perMinuteRate ?? 50);
            setSpecialties((c.specialties ?? []).join(", "));
            setLanguages((c.languages ?? []).join(", "));
            setSubdomain(c.subdomain ?? null);
            setCategory(String(c.category ?? "").toLowerCase().replace(/_/g, "-"));
            setRequestRates({
              perMinuteRate: c.perMinuteRate ?? 50,
              chatRate: c.chatRate ?? 50,
              audioRate: c.audioRate ?? 75,
              videoRate: c.videoRate ?? 100,
            });
          }
        }

        if (catalogRes.ok) {
          const d = await catalogRes.json();
          setCatalog(d.groups ?? []);
        }

        if (servicesRes.ok) {
          const d = await servicesRes.json();
          const slugs: string[] = (d.services ?? [])
            .map((s: { Service?: { slug?: string } }) => s.Service?.slug)
            .filter((x: unknown): x is string => typeof x === "string");
          setSelectedServiceSlugs(slugs);
          setInitialServiceSlugs(slugs);
        }
      } catch {
        /* non-fatal */
      }
      setLoading(false);
    })();
  }, []);

  const toggleService = (slug: string) => {
    setSelectedServiceSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const profileRes = await fetch("/api/consultant/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: bio.trim(),
          perMinuteRate: Number(rate),
          specialties: specialties.split(",").map((s) => s.trim()).filter(Boolean),
          languages: languages.split(",").map((s) => s.trim()).filter(Boolean),
          category,
        }),
      });
      if (!profileRes.ok) {
        const data = await profileRes.json().catch(() => ({}));
        setError((data as { error?: string }).error || "Profile save failed");
        return;
      }

      const servicesRes = await fetch("/api/consultant/services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          services: selectedServiceSlugs.map((slug) => ({ slug })),
        }),
      });
      if (!servicesRes.ok) {
        const data = await servicesRes.json().catch(() => ({}));
        setError((data as { error?: string }).error || "Services save failed");
        return;
      }

      setSaved(true);
      setInitialServiceSlugs(selectedServiceSlugs);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const submitPricingRequest = async () => {
    setSubmittingRequest(true);
    setError(null);
    try {
      const res = await fetch("/api/consultant/pricing-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedRates: requestRates,
          reason: requestReason,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Request failed");
      }
      setShowPricingRequest(false);
      setRequestReason("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSubmittingRequest(false);
    }
  };

  const copySubdomain = async () => {
    if (!subdomain) return;
    try {
      await navigator.clipboard.writeText(`https://${subdomain}.zeal.app`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#9D7DC5]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Update your public practice profile</p>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-5 lg:p-6 space-y-5">
        {/* Bio */}
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
            Professional Bio (min 20 chars)
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={6}
            className="w-full p-4 bg-slate-950 border border-white/10 rounded-2xl text-sm text-white resize-none focus:border-indigo-500 outline-none"
            placeholder="Describe your practice, lineage, and approach…"
          />
          <p className="text-xs text-slate-500 mt-1.5">
            {bio.trim().length}/1000 · {bio.trim().length >= 20 ? "✓ meets minimum" : "min 20 chars"}
          </p>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
            Primary Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-sm text-white outline-none focus:border-indigo-500"
          >
            <option value="">Select category…</option>
            {catalog.map((g) => (
              <option key={g.categoryId} value={g.categoryId}>
                {g.categoryName}
              </option>
            ))}
          </select>
        </div>

        {/* Services */}
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
            Services You Offer
          </label>
          <div className="max-h-64 overflow-y-auto space-y-3 p-3 rounded-2xl bg-slate-950 border border-white/5">
            {catalog.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">Loading services…</p>
            ) : (
              catalog.map((g) => (
                <div key={g.categoryId}>
                  <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1.5">
                    {g.categoryName}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.services.map((s) => {
                      const active = selectedServiceSlugs.includes(s.slug);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleService(s.slug)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                            active
                              ? "bg-purple-600 text-white border-purple-500"
                              : "bg-slate-950 border-white/10 text-slate-300 hover:border-purple-500/40"
                          }`}
                        >
                          {active && <Check size={11} className="inline mr-1" />}
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rate + Earnings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
              Per-minute rate (₹)
            </label>
            <input
              type="number"
              min={10}
              max={500}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-sm text-white focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
              You earn
            </label>
            <div className="px-4 py-3 bg-slate-950 border border-white/5 rounded-2xl text-sm text-emerald-400 font-black font-mono">
              ₹{Math.round(rate * 0.9)}/min (90%)
            </div>
          </div>
        </div>

        {/* Specialties */}
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
            Specialties (comma separated)
          </label>
          <input
            type="text"
            value={specialties}
            onChange={(e) => setSpecialties(e.target.value)}
            className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-sm text-white focus:border-indigo-500 outline-none"
            placeholder="Vedic Astrology, KP, Nadi"
          />
        </div>

        {/* Languages */}
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
            Languages (comma separated)
          </label>
          <input
            type="text"
            value={languages}
            onChange={(e) => setLanguages(e.target.value)}
            className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-sm text-white focus:border-indigo-500 outline-none"
            placeholder="English, Hindi"
          />
        </div>

        {/* Subdomain */}
        {subdomain && (
          <div className="p-4 rounded-2xl bg-[#9D7DC5]/10 border border-[#9D7DC5]/20">
            <p className="text-[10px] uppercase tracking-widest text-[#9D7DC5] font-bold mb-1">
              Your white-label site
            </p>
            <div className="flex items-center gap-2">
              <p className="text-sm font-mono text-white flex-1 truncate">
                {subdomain}.zeal.app
              </p>
              <button
                type="button"
                onClick={copySubdomain}
                className="p-2 rounded-lg hover:bg-white/10 text-[#9D7DC5]"
                aria-label="Copy white-label URL"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )}

        {/* Pricing request button */}
        <button
          type="button"
          onClick={() => setShowPricingRequest(true)}
          className="w-full py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black text-sm hover:bg-amber-500/20 transition-all flex items-center justify-center gap-2"
        >
          <IndianRupee size={16} /> Request Pricing Change
        </button>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={save}
          disabled={saving || bio.trim().length < 20}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-black hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Saving…
            </>
          ) : saved ? (
            <>
              <Check size={15} /> Saved
            </>
          ) : (
            <>
              <Save size={15} /> Save changes
            </>
          )}
        </button>
      </div>

      {/* Pricing request modal */}
      {showPricingRequest && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-white">Request Pricing Change</h3>
              <button
                type="button"
                onClick={() => setShowPricingRequest(false)}
                className="p-1 rounded-lg hover:bg-white/10"
              >
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              {(["perMinuteRate", "chatRate", "audioRate", "videoRate"] as const).map((field) => (
                <div key={field}>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                    {field.replace(/([A-Z])/g, " $1").trim()} (₹)
                  </label>
                  <input
                    type="number"
                    value={requestRates[field]}
                    onChange={(e) =>
                      setRequestRates({ ...requestRates, [field]: Number(e.target.value) })
                    }
                    className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-white font-mono outline-none focus:border-indigo-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                  Reason (min 30 chars)
                </label>
                <textarea
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm text-white resize-none outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  {requestReason.length}/30 minimum
                </p>
              </div>
              <button
                type="button"
                onClick={submitPricingRequest}
                disabled={requestReason.length < 30 || submittingRequest}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-sm disabled:opacity-50"
              >
                {submittingRequest ? "Submitting…" : "Submit for Approval"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
TSX_EOF

ok "Rewrote $SETTINGS"

# ═══════════════════════════════════════════════════════════════════════════════
head_ "PHASE 2 — Fix apps/web/lib/chat/offline-store.ts"
# ═══════════════════════════════════════════════════════════════════════════════

OFFLINE_STORE="apps/web/lib/chat/offline-store.ts"

if [[ ! -f "$OFFLINE_STORE" ]]; then
  warn "$OFFLINE_STORE not found — skipping"
else
  backup "$OFFLINE_STORE"

  # Replace the two `const last = messages[messages.length - 1];` with a
  # safe form that satisfies TypeScript's noUncheckedIndexedAccess flag.
  node - "$OFFLINE_STORE" <<'NODE_EOF'
const fs = require("fs");
const file = process.argv[2];
let src = fs.readFileSync(file, "utf8");

// Fix pattern 1: `const last = messages[messages.length - 1];`
src = src.replace(
  /const last = messages\[messages\.length - 1\];/g,
  "const last = messages[messages.length - 1];\n    if (!last) return;",
);

// Fix pattern 2: any `messages[messages.length - 1].X` usage
src = src.replace(
  /messages\[messages\.length - 1\]\.(\w+)/g,
  "(messages[messages.length - 1]?.$1 ?? new Date().toISOString())",
);

fs.writeFileSync(file, src, "utf8");
console.log("  → patched 'last' guard");
NODE_EOF

  ok "Patched $OFFLINE_STORE"
fi

# ═══════════════════════════════════════════════════════════════════════════════
head_ "PHASE 3 — Verify weights (awk, no paste/bc)"
# ═══════════════════════════════════════════════════════════════════════════════

SERVER="packages/database/src/server.ts"

DB_WEIGHTS=$(
  awk '
    /id: "bio"|id: "rate"|id: "specialties"|id: "availability"|id: "languages"|id: "category"/ { in_check=1 }
    /weight:/ && in_check { match($0, /[0-9]+/); if (RSTART > 0) sum += substr($0, RSTART, RLENGTH); in_check=0 }
    END { print sum+0 }
  ' "$SERVER" 2>/dev/null || echo "0"
)

printf "  DB file weight total: %s\n" "$DB_WEIGHTS"
if [[ "$DB_WEIGHTS" == "100" ]]; then
  ok "DB weights sum to 100 ✓"
else
  warn "DB weights sum to $DB_WEIGHTS (expected 100)"
fi

LAYOUT="apps/admin/app/consultant/layout.tsx"

if [[ -f "$LAYOUT" ]]; then
  LAYOUT_WEIGHTS=$(
    awk '
      /s \+= [0-9]+/ {
        match($0, /s \+= [0-9]+/)
        s = substr($0, RSTART, RLENGTH)
        gsub(/s \+= /, "", s)
        sum += s
      }
      END { print sum+0 }
    ' "$LAYOUT" 2>/dev/null || echo "0"
  )
  printf "  Layout file weight total: %s\n" "$LAYOUT_WEIGHTS"
  if [[ "$LAYOUT_WEIGHTS" == "100" ]]; then
    ok "Layout weights sum to 100 ✓"
  else
    warn "Layout weights sum to $LAYOUT_WEIGHTS (expected 100)"
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
head_ "PHASE 4 — Install dependencies"
# ═══════════════════════════════════════════════════════════════════════════════

if [[ "${SKIP_INSTALL:-0}" == "1" ]]; then
  warn "SKIP_INSTALL=1 — skipping"
else
  if [[ ! -d node_modules/lz-string ]]; then
    echo "  → npm install (installing lz-string)…"
    npm install --legacy-peer-deps >/dev/null 2>&1 || true
  fi
fi

if [[ -d node_modules/lz-string ]]; then
  ok "lz-string installed"
else
  fail "lz-string not found in node_modules"
fi

# ═══════════════════════════════════════════════════════════════════════════════
head_ "PHASE 5 — Type-check"
# ═══════════════════════════════════════════════════════════════════════════════

TC_OK=1

if npm run type-check --workspace=admin >/tmp/zeal-admin-tc.log 2>&1; then
  ok "admin type-check clean"
else
  fail "admin type-check failed"
  TC_OK=0
  echo ""
  echo "  ─── admin errors ───"
  grep "error TS" /tmp/zeal-admin-tc.log | head -20 | sed 's/^/    /' || tail -20 /tmp/zeal-admin-tc.log | sed 's/^/    /'
fi

if npm run type-check --workspace=web >/tmp/zeal-web-tc.log 2>&1; then
  ok "web type-check clean"
else
  fail "web type-check failed"
  TC_OK=0
  echo ""
  echo "  ─── web errors ───"
  grep "error TS" /tmp/zeal-web-tc.log | head -20 | sed 's/^/    /' || tail -20 /tmp/zeal-web-tc.log | sed 's/^/    /'
fi

# ═══════════════════════════════════════════════════════════════════════════════
head_ "PHASE 6 — Build"
# ═══════════════════════════════════════════════════════════════════════════════

BUILD_OK=1

if [[ "$TC_OK" == "1" ]]; then
  if npm run build --workspace=admin >/tmp/zeal-admin-build.log 2>&1; then
    ok "admin build succeeded"
  else
    fail "admin build failed"
    BUILD_OK=0
    tail -30 /tmp/zeal-admin-build.log | sed 's/^/    /'
  fi

  if npm run build --workspace=web >/tmp/zeal-web-build.log 2>&1; then
    ok "web build succeeded"
  else
    fail "web build failed"
    BUILD_OK=0
    tail -30 /tmp/zeal-web-build.log | sed 's/^/    /'
  fi
else
  warn "Skipped builds because type-check failed"
  BUILD_OK=0
fi

# ═══════════════════════════════════════════════════════════════════════════════
head_ "REPORT"
# ═══════════════════════════════════════════════════════════════════════════════

printf "\n"
printf "  DB weights      : %s\n" "$DB_WEIGHTS"
printf "  Type-check      : %s\n" "$([[ "$TC_OK" == "1" ]] && echo "PASS" || echo "FAIL")"
printf "  Build           : %s\n" "$([[ "$BUILD_OK" == "1" ]] && echo "PASS" || echo "FAIL")"
printf "  Backup          : %s\n" "$BK"
printf "\n"

if [[ "$DB_WEIGHTS" == "100" && "$TC_OK" == "1" && "$BUILD_OK" == "1" ]]; then
  printf "${G}${B}  ✓ All checks passed${N}\n\n"
  printf "  Next steps:\n"
  printf "    1. Commit + push:\n"
  printf "       git add -A && git commit -m 'fix: settings page, offline-store, weights' && git push\n"
  printf "    2. Deploy + hard-refresh\n"
  printf "\n"
  exit 0
else
  printf "${R}${B}  ✗ Some checks failed — see logs above${N}\n"
  printf "  Full logs: /tmp/zeal-*-tc.log, /tmp/zeal-*-build.log\n"
  exit 1
fi