import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Zeal",
  description:
    "Why we built Zeal — a place where verified Vedic astrologers, tarot readers, therapists and free AI tools sit in one calm, private app.",
};

export default function AboutPage() {
  return (
    <>
      <header className="border-b border-[var(--color-luxury-glass-border)] bg-surface/40 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-luxury-gold)] mb-3">
            About · The reason this exists
          </p>
          <h1 className="text-3xl md:text-5xl font-black text-foreground leading-tight">
            A quieter corner of the internet for questions that matter.
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground leading-relaxed">
            Zeal started as a frustration with the state of online astrology. Half the
            apps were ad farms that sold your birth chart to data brokers. The other
            half were WhatsApp operators who took your money on UPI and ghosted you
            halfway through a session. Both felt like they were built for the buyer's
            margin, not your question.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14 space-y-10">
        <section>
          <h2 className="text-xl md:text-2xl font-black text-foreground mb-3">
            What we're actually building
          </h2>
          <p className="text-sm md:text-base leading-relaxed text-muted-foreground">
            One product where a first-time user can try a free, honest kundali reading
            at 2 a.m., and where the same person can, three weeks later, sit down
            with a real therapist for a proper 45-minute session — with the same
            wallet, the same chat history, and the same escrow protections. Both
            halves had to work before either was worth shipping.
          </p>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-black text-foreground mb-3">
            What we won't do
          </h2>
          <ul className="space-y-2 text-sm md:text-base leading-relaxed text-muted-foreground list-disc pl-6">
            <li>Sell your data. There is no ad slot. There is no analytics pixel beyond the one page-load counter we need to keep the site fast.</li>
            <li>Pretend a robot is a human. AI consultants on Zeal are labelled as AI, clearly, at every layer of the interface.</li>
            <li>Take a commission you didn't earn. Consultations are held in escrow; if the astrologer doesn't show, the refund is automatic and the money is back in your wallet within seconds.</li>
            <li>Gate knowledge behind a paywall. Every service in the free tier — kundali, tarot, numerology, horoscope, panchang, guna milan, dream, palmistry — stays free.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-black text-foreground mb-3">
            How the tech works
          </h2>
          <p className="text-sm md:text-base leading-relaxed text-muted-foreground">
            The ephemeris engine runs on Swiss Ephemeris at arc-second precision —
            the same reference an experienced Jyotishi uses. Chat streams from a
            Cloudflare Worker on D1 + R2 so realtime survives a spotty 4G
            connection. The Next.js app runs on Vercel's edge, the primary database
            is Postgres (Supabase, Mumbai region), and every rupee that moves goes
            through Razorpay with escrow accounting we wrote ourselves. Nothing
            exotic — just the boring stack that lets us sleep at night.
          </p>
        </section>

        <section>
          <h2 className="text-xl md:text-2xl font-black text-foreground mb-3">
            Who's behind it
          </h2>
          <p className="text-sm md:text-base leading-relaxed text-muted-foreground">
            Small team. Full-time engineers and astrologers who've each spent years
            in their own craft. If you have feedback, a bug, or a consultant you
            want us to vet, write to <span className="font-bold text-foreground">support@zealer.co.in</span>.
            A human reads it.
          </p>
        </section>

        <nav className="pt-6 border-t border-border flex flex-wrap gap-3 text-xs font-bold">
          <Link href="/services" className="text-[var(--color-primary)] hover:underline">Try a free reading</Link>
          <Link href="/explore" className="text-[var(--color-primary)] hover:underline">Browse consultants</Link>
          <Link href="/contact" className="text-[var(--color-primary)] hover:underline">Contact</Link>
        </nav>
      </main>
    </>
  );
}
