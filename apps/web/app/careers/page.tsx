import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "We're hiring thoughtful engineers, careful astrologers and patient support folk in India. Read how the team works before you apply.",
};

const ROLES = [
  {
    title: "Senior Backend Engineer (TypeScript / Postgres)",
    kind: "Full-time · Remote (India)",
    blurb:
      "Own the billing engine, the escrow state machine, and the realtime fan-out layer. You've written money-touching code before and are paranoid about double-charges.",
  },
  {
    title: "Verified Vedic Astrologer (Consultant)",
    kind: "Contract · Work from anywhere",
    blurb:
      "Join our consultant roster. We pay per session minute, in escrow, released to your wallet the moment the call ends. Send us a two-page writing sample on a chart you worked recently.",
  },
  {
    title: "Customer Support Lead (Hinglish + English)",
    kind: "Full-time · Bengaluru hybrid",
    blurb:
      "Own the dispute queue. Talk to real people who are upset about money or a session that didn't go well. Deep-listening beats script-reading.",
  },
];

export default function CareersPage() {
  return (
    <>
      <header className="border-b border-[var(--color-luxury-glass-border)] bg-surface/40 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-20">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-luxury-gold)] mb-3">
            Careers · Join us
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-foreground leading-tight">
            Small team. Real work. Honest pay.
          </h1>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-2xl">
            We hire for judgment over raw speed. Our salary bands are published
            internally on day one, everyone gets a slice of the upside, and no
            meeting is longer than it needs to be.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14 space-y-6">
        {ROLES.map((r) => (
          <article
            key={r.title}
            className="rounded-2xl border border-border bg-surface p-6 hover:border-[var(--color-primary)]/40 transition"
          >
            <h2 className="text-base md:text-lg font-black text-foreground">{r.title}</h2>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[var(--color-luxury-gold)]">
              {r.kind}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{r.blurb}</p>
            <Link
              href={`/contact?subject=${encodeURIComponent(`Applying: ${r.title}`)}`}
              className="inline-flex mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white text-xs font-black"
            >
              Apply via contact form
            </Link>
          </article>
        ))}

        <p className="pt-6 text-xs text-muted-foreground">
          Don't see your role? Send a short note anyway. We read every one.
        </p>
      </main>
    </>
  );
}
