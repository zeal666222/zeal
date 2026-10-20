"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Admin Settings hub — platform defaults (live) + entry points to the two
// functional sub-consoles (Admins, API Keys). Platform values are read-only
// here because the settings PUT currently only audit-logs (no persistence);
// editing them from this screen would be a fake flow, so we surface truth and
// link out instead.
// ═══════════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Globe,
  KeyRound,
  ShieldCheck,
  Wallet,
  Wrench,
} from "lucide-react";

interface PlatformSettings {
  platformFeePercent: number;
  minimumWithdrawal: number;
  maintenanceMode: boolean;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

export default function AdminSettingsPage() {
  const { data, isLoading, isError } = useQuery<PlatformSettings>({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
  });

  const cards = [
    {
      href: "/admin/settings/admins",
      icon: ShieldCheck,
      title: "Administrators",
      desc: "Invite, promote and revoke staff accounts across every role.",
    },
    {
      href: "/admin/settings/api-keys",
      icon: KeyRound,
      title: "API Keys",
      desc: "Issue and rotate machine-to-machine keys for integrations.",
    },
  ];

  return (
    <div className="space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-white/50">
          Platform configuration and access management.
        </p>
      </header>

      {/* Platform defaults */}
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-5">
        <div className="mb-4 flex items-center gap-2">
          <Globe className="h-4 w-4 text-[var(--color-primary)]" />
          <h2 className="text-sm font-semibold text-white">Platform defaults</h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : isError || !data ? (
          <p className="text-sm text-rose-400">
            Could not load platform settings.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat label="Platform fee" value={`${data.platformFeePercent}%`} />
              <Stat
                label="Min withdrawal"
                value={`₹${data.minimumWithdrawal.toLocaleString("en-IN")}`}
              />
              <Stat
                label="Maintenance"
                value={data.maintenanceMode ? "Enabled" : "Disabled"}
              />
            </div>
            {data.maintenanceMode && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-400">
                <Wrench className="h-3.5 w-3.5" />
                Maintenance mode is on — non-admin visitors are blocked.
              </p>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-white/35">
              <Wallet className="h-3.5 w-3.5" />
              These values are managed by the platform owner. Reach out to change
              them.
            </p>
          </>
        )}
      </section>

      {/* Entry points */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c, i) => (
          <motion.div
            key={c.href}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              href={c.href}
              className="group flex h-full items-start gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/25 hover:bg-white/[0.06]"
            >
              <span className="mt-0.5 rounded-2xl bg-[var(--color-primary)]/15 p-2.5 text-[var(--color-primary)]">
                <c.icon className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <h3 className="font-semibold text-white">{c.title}</h3>
                <p className="mt-1 text-sm text-white/50">{c.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-white/30 transition group-hover:translate-x-1 group-hover:text-white" />
            </Link>
          </motion.div>
        ))}
      </section>
    </div>
  );
}
