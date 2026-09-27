import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface ServiceHeroProps {
 icon: string;
 displayName: string;
 categoryName: string;
 categoryId: string;
 description: string;
 consultantCount: number;
}

export function ServiceHero({
 icon,
 displayName,
 categoryName,
 categoryId,
 description,
 consultantCount,
}: ServiceHeroProps) {
 return (
 <div className="mb-8">
 <Link
 href="/services"
 className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline mb-4"
 >
 <ChevronLeft className="w-4 h-4" /> Back to Zeal Hub
 </Link>

 <div className="flex items-start gap-4">
 <div className="text-5xl flex-shrink-0">{icon}</div>
 <div>
 <p className="text-xs text-[var(--color-subtle-foreground)] uppercase tracking-wider mb-1">
 {categoryName}
 </p>
 <h1 className="text-2xl md:text-3xl font-bold text-muted-foreground mb-1">
 {displayName}
 </h1>
 <p className="text-sm text-[var(--color-subtle-foreground)] dark:text-gray-400">
 {description}
 </p>
 <p className="text-sm text-[var(--color-primary)] mt-2 font-medium">
 {consultantCount} verified consultant{consultantCount !== 1 ? "s" : ""} available
 </p>
 </div>
 </div>
 </div>
 );
}

// BATCH_F1_APPLIED
