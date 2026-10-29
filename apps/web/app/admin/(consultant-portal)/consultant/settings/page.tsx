"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Save, IndianRupee, X, Globe, CreditCard, Eye, EyeOff, Upload } from "lucide-react";

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
  // The platform's cut comes from the server so the payout preview cannot drift
  // from what the booking actually settles at.
  const [platformFeePercent, setPlatformFeePercent] = useState(10);
  const [requestReason, setRequestReason] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Bank details
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [savingBank, setSavingBank] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);

  // Landing page
  const [lpHeroTitle, setLpHeroTitle] = useState("");
  const [lpHeroSubtitle, setLpHeroSubtitle] = useState("");
  const [lpAboutHeading, setLpAboutHeading] = useState("");
  const [lpAboutBody, setLpAboutBody] = useState("");
  const [lpSeoTitle, setLpSeoTitle] = useState("");
  const [lpSeoDesc, setLpSeoDesc] = useState("");
  const [lpShowServices, setLpShowServices] = useState(true);
  const [lpShowTestimonials, setLpShowTestimonials] = useState(true);
  const [lpShowContact, setLpShowContact] = useState(true);
  const [lpContactWhatsapp, setLpContactWhatsapp] = useState("");
  const [lpContactEmail, setLpContactEmail] = useState("");
  const [lpContactPhone, setLpContactPhone] = useState("");
  const [lpIsPublished, setLpIsPublished] = useState(false);
  const [savingPage, setSavingPage] = useState(false);
  const [pageSaved, setPageSaved] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "bank" | "landing">("profile");

  useEffect(() => {
    (async () => {
      try {
        const [pulseRes, catalogRes, servicesRes] = await Promise.all([
          fetch("/api/consultant-portal/pulse", { cache: "no-store" }),
          fetch("/api/consultants/service-catalog", { cache: "no-store" }),
          fetch("/api/consultant-portal/services", { cache: "no-store" }),
        ]);

        if (pulseRes.ok) {
          const data = await pulseRes.json();
          if (typeof data?.platformFeePercent === "number") {
            setPlatformFeePercent(data.platformFeePercent);
          }
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

        // Fetch bank details
        try {
          const bankRes = await fetch("/api/consultant-portal/bank", { cache: "no-store" });
          if (bankRes.ok) {
            const d = await bankRes.json();
            if (d.success) {
              setBankAccount(d.accountNumber ?? "");
              setBankIfsc(d.ifsc ?? "");
              setBankHolder(d.accountHolder ?? "");
            }
          }
        } catch { /* non-fatal */ }

        // Fetch landing page
        try {
          const pageRes = await fetch("/api/consultant-portal/landing-page", { cache: "no-store" });
          if (pageRes.ok) {
            const d = await pageRes.json();
            if (d.success && d.page) {
              const p = d.page;
              setLpHeroTitle(p.heroTitle ?? "");
              setLpHeroSubtitle(p.heroSubtitle ?? "");
              setLpAboutHeading(p.aboutHeading ?? "");
              setLpAboutBody(p.aboutBody ?? "");
              setLpSeoTitle(p.seoTitle ?? "");
              setLpSeoDesc(p.seoDescription ?? "");
              setLpShowServices(p.showServices ?? true);
              setLpShowTestimonials(p.showTestimonials ?? true);
              setLpShowContact(p.showContact ?? true);
              setLpContactWhatsapp(p.contactWhatsapp ?? "");
              setLpContactEmail(p.contactEmail ?? "");
              setLpContactPhone(p.contactPhone ?? "");
              setLpIsPublished(p.isPublished ?? false);
            }
          }
        } catch { /* non-fatal */ }
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
      const profileRes = await fetch("/api/consultant-portal/profile", {
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

      const servicesRes = await fetch("/api/consultant-portal/services", {
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
      const res = await fetch("/api/consultant-portal/pricing-request", {
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
      await navigator.clipboard.writeText(`https://${subdomain}.zealer.co.in`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const saveBank = async () => {
    setSavingBank(true);
    setBankSaved(false);
    setBankError(null);
    try {
      const res = await fetch("/api/consultant-portal/bank", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber: bankAccount.trim(),
          ifsc: bankIfsc.trim().toUpperCase(),
          accountHolder: bankHolder.trim(),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save bank details");
      }
      setBankSaved(true);
      setTimeout(() => setBankSaved(false), 2000);
    } catch (e) {
      setBankError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSavingBank(false);
    }
  };

  const saveLandingPage = async () => {
    setSavingPage(true);
    setPageSaved(false);
    setPageError(null);
    try {
      const res = await fetch("/api/consultant-portal/landing-page", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroTitle: lpHeroTitle.trim(),
          heroSubtitle: lpHeroSubtitle.trim(),
          aboutHeading: lpAboutHeading.trim(),
          aboutBody: lpAboutBody.trim(),
          seoTitle: lpSeoTitle.trim(),
          seoDescription: lpSeoDesc.trim(),
          showServices: lpShowServices,
          showTestimonials: lpShowTestimonials,
          showContact: lpShowContact,
          contactWhatsapp: lpContactWhatsapp.trim() || null,
          contactEmail: lpContactEmail.trim() || null,
          contactPhone: lpContactPhone.trim() || null,
          isPublished: lpIsPublished,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save landing page");
      }
      setPageSaved(true);
      setTimeout(() => setPageSaved(false), 2000);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSavingPage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile, payments, and landing page</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-surface-raised rounded-2xl border border-border">
        {([
          { key: "profile" as const, label: "Profile", icon: Save },
          { key: "bank" as const, label: "Bank Details", icon: CreditCard },
          { key: "landing" as const, label: "Landing Page", icon: Globe },
        ]).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === tab.key
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══ PROFILE TAB ═══ */}
      {activeTab === "profile" && (
        <div className="bg-surface backdrop-blur-xl border border-border rounded-3xl p-5 lg:p-6 space-y-5">
        {/* Bio */}
        <div>
          <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
            Professional Bio (min 20 chars)
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={6}
            className="w-full p-4 bg-surface-raised border border-border rounded-2xl text-sm text-foreground resize-none focus:border-indigo-500 outline-none"
            placeholder="Describe your practice, lineage, and approach…"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            {bio.trim().length}/1000 · {bio.trim().length >= 20 ? "✓ meets minimum" : "min 20 chars"}
          </p>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
            Primary Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-3 bg-surface-raised border border-border rounded-2xl text-sm text-foreground outline-none focus:border-indigo-500"
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
          <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
            Services You Offer
          </label>
          <div className="max-h-64 overflow-y-auto space-y-3 p-3 rounded-2xl bg-surface-raised border border-border">
            {catalog.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Loading services…</p>
            ) : (
              catalog.map((g) => (
                <div key={g.categoryId}>
                  <p className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1.5">
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
                              : "bg-surface-raised border-border text-muted-foreground hover:border-purple-500/40"
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
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
              Per-minute rate (₹)
            </label>
            <input
              type="number"
              min={10}
              max={500}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full px-4 py-3 bg-surface-raised border border-border rounded-2xl text-sm text-foreground focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
              You earn
            </label>
            <div className="px-4 py-3 bg-surface-raised border border-border rounded-2xl text-sm text-emerald-600 dark:text-emerald-400 font-black font-mono">
              ₹{Math.round(rate * (1 - platformFeePercent / 100))}/min ({100 - platformFeePercent}%)
            </div>
          </div>
        </div>

        {/* Specialties */}
        <div>
          <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
            Specialties (comma separated)
          </label>
          <input
            type="text"
            value={specialties}
            onChange={(e) => setSpecialties(e.target.value)}
            className="w-full px-4 py-3 bg-surface-raised border border-border rounded-2xl text-sm text-foreground focus:border-indigo-500 outline-none"
            placeholder="Vedic Astrology, KP, Nadi"
          />
        </div>

        {/* Languages */}
        <div>
          <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
            Languages (comma separated)
          </label>
          <input
            type="text"
            value={languages}
            onChange={(e) => setLanguages(e.target.value)}
            className="w-full px-4 py-3 bg-surface-raised border border-border rounded-2xl text-sm text-foreground focus:border-indigo-500 outline-none"
            placeholder="English, Hindi"
          />
        </div>

        {/* Subdomain */}
        {subdomain && (
          <div className="p-4 rounded-2xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20">
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-primary)] font-bold mb-1">
              Your white-label site
            </p>
            <div className="flex items-center gap-2">
              <p className="text-sm font-mono text-foreground flex-1 truncate">
                {subdomain}.zealer.co.in
              </p>
              <button
                type="button"
                onClick={copySubdomain}
                className="p-2 rounded-lg hover:bg-surface-overlay text-[var(--color-primary)]"
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
          className="w-full py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-black text-sm hover:bg-amber-500/20 transition-all flex items-center justify-center gap-2"
        >
          <IndianRupee size={16} /> Request Pricing Change
        </button>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
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
      )}

      {/* ═══ BANK DETAILS TAB ═══ */}
      {activeTab === "bank" && (
        <div className="bg-surface backdrop-blur-xl border border-border rounded-3xl p-5 lg:p-6 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CreditCard size={20} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground">Bank Account Details</h2>
              <p className="text-xs text-muted-foreground">Required for withdrawal processing</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
              Account Holder Name
            </label>
            <input
              type="text"
              value={bankHolder}
              onChange={(e) => setBankHolder(e.target.value)}
              className="w-full px-4 py-3 bg-surface-raised border border-border rounded-2xl text-sm text-foreground focus:border-emerald-500 outline-none"
              placeholder="As per bank records"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
              Account Number
            </label>
            <input
              type="text"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              className="w-full px-4 py-3 bg-surface-raised border border-border rounded-2xl text-sm text-foreground font-mono focus:border-emerald-500 outline-none"
              placeholder="Enter bank account number"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
              IFSC Code
            </label>
            <input
              type="text"
              value={bankIfsc}
              onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 bg-surface-raised border border-border rounded-2xl text-sm text-foreground font-mono focus:border-emerald-500 outline-none"
              placeholder="e.g. SBIN0001234"
              maxLength={11}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              {bankIfsc.length > 0 && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc) && bankIfsc.length >= 4
                ? "Invalid IFSC format"
                : "11-character code from your bank"}
            </p>
          </div>

          {bankError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
              {bankError}
            </div>
          )}

          <button
            type="button"
            onClick={saveBank}
            disabled={savingBank || !bankAccount.trim() || !bankIfsc.trim() || !bankHolder.trim() || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc)}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-black hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
          >
            {savingBank ? (
              <><Loader2 size={15} className="animate-spin" /> Saving...</>
            ) : bankSaved ? (
              <><Check size={15} /> Saved</>
            ) : (
              <><Save size={15} /> Save Bank Details</>
            )}
          </button>
        </div>
      )}

      {/* ═══ LANDING PAGE TAB ═══ */}
      {activeTab === "landing" && (
        <div className="space-y-5">
          {/* Subdomain status */}
          {subdomain ? (
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-purple-400 font-bold mb-1">Your Landing Page</p>
                  <p className="text-sm font-mono text-foreground">{subdomain}.zealer.co.in</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copySubdomain}
                    className="p-2 rounded-lg hover:bg-purple-500/20 text-purple-400 transition-colors"
                    aria-label="Copy URL"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <a
                    href={`/white-label/${subdomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-purple-500/20 text-purple-400 transition-colors"
                    aria-label="View page"
                  >
                    <Eye size={14} />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">
                No subdomain assigned yet. Contact admin to get your landing page URL.
              </p>
            </div>
          )}

          {/* Hero section */}
          <div className="bg-surface backdrop-blur-xl border border-border rounded-3xl p-5 lg:p-6 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <Globe size={20} className="text-indigo-500" />
              </div>
              <div>
                <h2 className="text-lg font-black text-foreground">Landing Page Content</h2>
                <p className="text-xs text-muted-foreground">Customize your public-facing page</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                Hero Title
              </label>
              <input
                type="text"
                value={lpHeroTitle}
                onChange={(e) => setLpHeroTitle(e.target.value)}
                className="w-full px-4 py-3 bg-surface-raised border border-border rounded-2xl text-sm text-foreground focus:border-indigo-500 outline-none"
                placeholder="Welcome to My Practice"
                maxLength={200}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                Hero Subtitle
              </label>
              <textarea
                value={lpHeroSubtitle}
                onChange={(e) => setLpHeroSubtitle(e.target.value)}
                rows={2}
                className="w-full p-4 bg-surface-raised border border-border rounded-2xl text-sm text-foreground resize-none focus:border-indigo-500 outline-none"
                placeholder="A brief tagline for your page..."
                maxLength={500}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                About Heading
              </label>
              <input
                type="text"
                value={lpAboutHeading}
                onChange={(e) => setLpAboutHeading(e.target.value)}
                className="w-full px-4 py-3 bg-surface-raised border border-border rounded-2xl text-sm text-foreground focus:border-indigo-500 outline-none"
                placeholder="About Me"
                maxLength={200}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                About Body
              </label>
              <textarea
                value={lpAboutBody}
                onChange={(e) => setLpAboutBody(e.target.value)}
                rows={4}
                className="w-full p-4 bg-surface-raised border border-border rounded-2xl text-sm text-foreground resize-none focus:border-indigo-500 outline-none"
                placeholder="Tell visitors about your practice, experience, and approach..."
                maxLength={5000}
              />
            </div>
          </div>

          {/* Sections visibility */}
          <div className="bg-surface backdrop-blur-xl border border-border rounded-3xl p-5 lg:p-6 space-y-4">
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Page Sections</h3>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm text-foreground">Show Services</span>
              <button
                type="button"
                onClick={() => setLpShowServices(!lpShowServices)}
                className={`relative w-11 h-6 rounded-full transition-colors ${lpShowServices ? "bg-indigo-600" : "bg-surface-raised border border-border"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${lpShowServices ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </label>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm text-foreground">Show Testimonials</span>
              <button
                type="button"
                onClick={() => setLpShowTestimonials(!lpShowTestimonials)}
                className={`relative w-11 h-6 rounded-full transition-colors ${lpShowTestimonials ? "bg-indigo-600" : "bg-surface-raised border border-border"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${lpShowTestimonials ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </label>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm text-foreground">Show Contact Info</span>
              <button
                type="button"
                onClick={() => setLpShowContact(!lpShowContact)}
                className={`relative w-11 h-6 rounded-full transition-colors ${lpShowContact ? "bg-indigo-600" : "bg-surface-raised border border-border"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${lpShowContact ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </label>
          </div>

          {/* Contact details */}
          {lpShowContact && (
            <div className="bg-surface backdrop-blur-xl border border-border rounded-3xl p-5 lg:p-6 space-y-4">
              <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Contact Information</h3>

              <div>
                <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                  WhatsApp Number
                </label>
                <input
                  type="text"
                  value={lpContactWhatsapp}
                  onChange={(e) => setLpContactWhatsapp(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-raised border border-border rounded-2xl text-sm text-foreground focus:border-indigo-500 outline-none"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={lpContactEmail}
                  onChange={(e) => setLpContactEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-raised border border-border rounded-2xl text-sm text-foreground focus:border-indigo-500 outline-none"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={lpContactPhone}
                  onChange={(e) => setLpContactPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-raised border border-border rounded-2xl text-sm text-foreground focus:border-indigo-500 outline-none"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
          )}

          {/* SEO */}
          <div className="bg-surface backdrop-blur-xl border border-border rounded-3xl p-5 lg:p-6 space-y-4">
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">SEO</h3>

            <div>
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                Page Title
              </label>
              <input
                type="text"
                value={lpSeoTitle}
                onChange={(e) => setLpSeoTitle(e.target.value)}
                className="w-full px-4 py-3 bg-surface-raised border border-border rounded-2xl text-sm text-foreground focus:border-indigo-500 outline-none"
                placeholder="My Spiritual Practice — Consultant"
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                Meta Description
              </label>
              <textarea
                value={lpSeoDesc}
                onChange={(e) => setLpSeoDesc(e.target.value)}
                rows={2}
                className="w-full p-4 bg-surface-raised border border-border rounded-2xl text-sm text-foreground resize-none focus:border-indigo-500 outline-none"
                placeholder="Brief description for search engines..."
                maxLength={300}
              />
            </div>
          </div>

          {/* Publish toggle + save */}
          <div className="bg-surface backdrop-blur-xl border border-border rounded-3xl p-5 lg:p-6 space-y-4">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-sm font-bold text-foreground">Publish Landing Page</p>
                <p className="text-xs text-muted-foreground">Make your page visible to the public</p>
              </div>
              <button
                type="button"
                onClick={() => setLpIsPublished(!lpIsPublished)}
                className={`relative w-11 h-6 rounded-full transition-colors ${lpIsPublished ? "bg-emerald-600" : "bg-surface-raised border border-border"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${lpIsPublished ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </label>

            {pageError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
                {pageError}
              </div>
            )}

            <button
              type="button"
              onClick={saveLandingPage}
              disabled={savingPage}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-black hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              {savingPage ? (
                <><Loader2 size={15} className="animate-spin" /> Saving...</>
              ) : pageSaved ? (
                <><Check size={15} /> Saved</>
              ) : (
                <><Save size={15} /> Save Landing Page</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Pricing request modal */}
      {showPricingRequest && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-surface border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-foreground">Request Pricing Change</h3>
              <button
                type="button"
                onClick={() => setShowPricingRequest(false)}
                className="p-1 rounded-lg hover:bg-surface-overlay"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              {(["perMinuteRate", "chatRate", "audioRate", "videoRate"] as const).map((field) => (
                <div key={field}>
                  <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">
                    {field.replace(/([A-Z])/g, " $1").trim()} (₹)
                  </label>
                  <input
                    type="number"
                    value={requestRates[field]}
                    onChange={(e) =>
                      setRequestRates({ ...requestRates, [field]: Number(e.target.value) })
                    }
                    className="w-full px-4 py-3 bg-surface-raised border border-border rounded-xl text-foreground font-mono outline-none focus:border-indigo-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">
                  Reason (min 30 chars)
                </label>
                <textarea
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-surface-raised border border-border rounded-xl text-sm text-foreground resize-none outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
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
