"use client";

import Link from "next/link";
import {motion} from "framer-motion";
import { Loader2, Sparkles, Wifi } from "lucide-react";
import {useAiConsultants, type AiConsultant} from "@/hooks/useAiConsultants";

function AiConsultantCard({
 consultant,
 index,
}: {
 consultant: AiConsultant;
 index: number;
}) {
 return (
 <motion.div
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: Math.min(index * 0.04, 0.3) }}
 >
 <Link
 href={`/ai-astrologers/${consultant.id}`}
 className="block p-4 rounded-2xl bg-surface border border-border hover:shadow-lg hover:-translate-y-1 transition-all"
 >
 <div className="flex items-start gap-3">
 <div className="relative flex-shrink-0">
 <img
 src={consultant.avatar}
 alt={consultant.name}
 className="w-14 h-14 rounded-full object-cover ring-2 ring-[var(--color-primary)]/30"
 loading="lazy"
 />
 <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white text-[8px] font-bold rounded-full">
 AI
 </span>
 </div>
 <div className="flex-1 min-w-0">
 <h3 className="font-semibold text-muted-foreground truncate">
 {consultant.name}
 </h3>
 <p className="text-xs text-[var(--color-subtle-foreground)] capitalize">
 {consultant.category.toLowerCase()}
 </p>
 <div className="flex items-center gap-2 mt-1 text-xs">
 <span className="text-yellow-500">
 ⭐ {consultant.rating.toFixed(1)}
 </span>
 <span className="text-[var(--color-subtle-foreground)]">
 {consultant.isPaid
 ? `₹${consultant.perMinuteRate}/min`
 : "Free"}
 </span>
 </div>
 </div>
 </div>
 <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
 {consultant.bio}
 </p>
 </Link>
 </motion.div>
 );
}

export default function AIAstrologersPage() {
 const { consultants, isLoading, error, isRealtime } = useAiConsultants();

 if (isLoading) {
 return (
 <div className="flex justify-center py-12">
 <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
 </div>
 );
 }

 if (error) {
 return (
 <div className="max-w-4xl mx-auto px-4 py-12 text-center text-red-500">
 <p>Failed to load AI consultants: {error}</p>
 </div>
 );
 }

 return (
 <div className="max-w-4xl mx-auto px-4 py-8">
 <div className="flex items-center gap-2 mb-6">
 <Sparkles className="w-6 h-6 text-[var(--color-primary)]" />
 <h1 className="text-2xl font-bold text-muted-foreground">
 AI Consultants
 </h1>
 <span className="text-sm text-[var(--color-subtle-foreground)]">
 ({consultants.length} available)
 </span>
 {isRealtime && (
 <span className="ml-auto flex items-center gap-1 text-xs text-green-500">
 <Wifi className="w-3 h-3" /> Live
 </span>
 )}
 </div>

 {consultants.length === 0 ? (
 <div className="text-center py-12 text-[var(--color-subtle-foreground)]">
 No AI consultants available yet. Check back soon!
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {consultants.map((c, idx) => (
 <AiConsultantCard key={c.id} consultant={c} index={idx} />
 ))}
 </div>
 )}
 </div>
 );
}
