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
