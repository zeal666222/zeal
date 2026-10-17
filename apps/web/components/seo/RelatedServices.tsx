import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RELATED_SERVICES } from "@/lib/seo/metadata";

export function RelatedServices({ serviceKey }: { serviceKey: string }) {
  const related = RELATED_SERVICES[serviceKey];
  if (!related?.length) return null;

  return (
    <nav aria-label="Related services" className="mt-12 pt-8 border-t border-border">
      <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">
        Related Services
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {related.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-2 px-4 py-3 rounded-xl bg-surface border border-border hover:border-[var(--color-luxury-gold)]/30 hover:shadow-lg transition-all text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {label}
            <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
          </Link>
        ))}
      </div>
    </nav>
  );
}
