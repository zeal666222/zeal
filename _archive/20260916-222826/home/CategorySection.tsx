"use client";

import Link from "next/link";
import { ConsultantCard } from "@/components/shared/ConsultantCard";
import type { ConsultantProfile } from "@zeal/types";

interface CategorySectionProps {
  title: string;
  icon: string;
  consultants: ConsultantProfile[];
  viewAllLink: string;
}

export function CategorySection({ title, icon, consultants, viewAllLink }: CategorySectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-[#5E4B8B] dark:text-white flex items-center gap-2">
          <span>{icon}</span> {title}
        </h2>
        <Link href={viewAllLink} className="text-sm text-[#9D7DC5] hover:underline">See All</Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
        {consultants.map((consultant) => (
          <ConsultantCard key={consultant.id} consultant={consultant} variant="vertical" />
        ))}
      </div>
    </section>
  );
}

