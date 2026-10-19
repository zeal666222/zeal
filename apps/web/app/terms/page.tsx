import type { Metadata } from "next";
import Link from "next/link";
import { legalSectionData } from "@/components/legal/data";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The rules for using Zeal — bookings, payments, community conduct, consultant obligations and content ownership.",
};

export default function TermsPage() {
  return (
    <>
      <header className="border-b border-[var(--color-luxury-glass-border)] bg-surface/40 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 py-14 md:py-20">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-luxury-gold)] mb-3">
            Legal · Agreements that matter
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-foreground leading-tight">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Last updated: 18 October 2026 · Applies to zealer.co.in
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14 space-y-12">
        {legalSectionData("terms").map((s) => (
          <section key={s.title}>
            <h2 className="text-xl font-black text-foreground mb-3">{s.title}</h2>
            {s.paragraphs.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-muted-foreground mb-3">
                {p}
              </p>
            ))}
            {s.list && (
              <ul className="list-disc pl-6 text-sm leading-relaxed text-muted-foreground space-y-1.5">
                {s.list.map((li, i) => (
                  <li key={i}>{li}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <nav className="pt-6 border-t border-border flex flex-wrap gap-3 text-xs font-bold">
          <Link href="/privacy" className="text-[var(--color-primary)] hover:underline">Privacy Policy</Link>
          <Link href="/refund" className="text-[var(--color-primary)] hover:underline">Refund Policy</Link>
          <Link href="/cookies" className="text-[var(--color-primary)] hover:underline">Cookie Policy</Link>
        </nav>
      </main>
    </>
  );
}
