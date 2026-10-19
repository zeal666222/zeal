import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Long-form pieces on Vedic astrology, tarot traditions, and the practical side of consulting a healer — from the Zeal team.",
};

// Blog content ships behind a CMS we haven't wired yet. Rather than 404,
// we render an honest empty state that points to the live surfaces the
// team updates daily (free services + consultant directory).
export default function BlogPage() {
  return (
    <>
      <header className="border-b border-[var(--color-luxury-glass-border)] bg-surface/40 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-20">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-luxury-gold)] mb-3">
            Blog · Field notes
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-foreground leading-tight">
            Written slowly, so you can read slowly.
          </h1>
          <p className="mt-4 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Long-form pieces from our astrologers, therapists, and engineering team.
            No listicles, no "top 10 gems for 2026", no astrology-as-marketing.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <div className="rounded-3xl border border-dashed border-border bg-surface/40 p-10 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            The blog is being written. In the meantime,{" "}
            <Link href="/services" className="text-[var(--color-primary)] font-bold hover:underline">
              free services
            </Link>{" "}
            are live and the{" "}
            <Link href="/explore" className="text-[var(--color-primary)] font-bold hover:underline">
              consultant directory
            </Link>{" "}
            has real astrologers you can talk to today.
          </p>
        </div>
      </main>
    </>
  );
}
