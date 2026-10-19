import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Reach the Zeal team — support, disputes, press, or partnership. A human reads every message.",
};

export default function ContactPage() {
  return (
    <>
      <header className="border-b border-[var(--color-luxury-glass-border)] bg-surface/40 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-6 py-16 md:py-20">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-luxury-gold)] mb-3">
            Contact · Talk to a person
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-foreground leading-tight">
            Write to us.
          </h1>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            Every email below is monitored by a real teammate, not a bot.
            Typical first reply: 4 hours on weekdays, same day for billing issues.
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        <section className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-sm font-black text-foreground mb-1">Product &amp; billing help</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Wallet, refunds, failed payments, "the consultant didn't join".
          </p>
          <a
            href="mailto:support@zealer.co.in"
            className="inline-block text-sm font-mono text-[var(--color-primary)] hover:underline"
          >
            support@zealer.co.in
          </a>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-sm font-black text-foreground mb-1">Report a bug or abuse</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Anything that looks broken or dangerous on the platform. Screenshot if
            you have one.
          </p>
          <a
            href="mailto:abuse@zealer.co.in"
            className="inline-block text-sm font-mono text-[var(--color-primary)] hover:underline"
          >
            abuse@zealer.co.in
          </a>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-sm font-black text-foreground mb-1">Press &amp; partnerships</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Media, white-label, consultant roster expansion.
          </p>
          <a
            href="mailto:hello@zealer.co.in"
            className="inline-block text-sm font-mono text-[var(--color-primary)] hover:underline"
          >
            hello@zealer.co.in
          </a>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-sm font-black text-foreground mb-1">Grievance Officer (IT Act, 2000)</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Required of every intermediary platform in India. Escalate here if
            standard support didn't resolve your issue within 15 days.
          </p>
          <a
            href="mailto:grievance@zealer.co.in"
            className="inline-block text-sm font-mono text-[var(--color-primary)] hover:underline"
          >
            grievance@zealer.co.in
          </a>
        </section>

        <p className="text-xs text-muted-foreground pt-4 border-t border-border">
          Prefer chat? Sign in and open <Link href="/chat" className="text-[var(--color-primary)] font-bold hover:underline">Messages</Link> —
          support threads land in the same inbox.
        </p>
      </main>
    </>
  );
}
