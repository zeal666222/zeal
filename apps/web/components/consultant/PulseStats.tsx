"use client";

import {motion} from "framer-motion";
import { Calendar, Clock, DollarSign, Radio } from "lucide-react";
import {formatCurrency} from "@zeal/utils";

interface PulseStatsProps {
 data?: {
 bookings?: unknown[];
 liveSessions?: number;
 pendingRequests?: number;
 earnings?: number;
 };
 loading?: boolean;
}

const CARDS = [
 { key: "bookings", label: "Today", icon: Calendar, color: "from-blue-400/20 to-blue-500/10" },
 { key: "liveSessions", label: "Live", icon: Radio, color: "from-green-400/20 to-green-500/10" },
 { key: "pendingRequests", label: "Pending", icon: Clock, color: "from-amber-400/20 to-amber-500/10" },
 { key: "earnings", label: "Earnings", icon: DollarSign, color: "from-[var(--color-primary)]/20 to-[var(--color-primary-hover)]/10" },
];

export function PulseStats({ data, loading }: PulseStatsProps) {
 const getValue = (key: string) => {
 if (!data) return "—";
 if (key === "bookings") return String(data.bookings?.length || 0);
 if (key === "liveSessions") return String(data.liveSessions || 0);
 if (key === "pendingRequests") return String(data.pendingRequests || 0);
 if (key === "earnings") return formatCurrency(data.earnings || 0);
 return "—";
 };

 return (
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
 {CARDS.map((card, idx) => {
 const Icon = card.icon;
 return (
 <motion.div
 key={card.key}
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{
 delay: idx * 0.05,
 type: "spring",
 stiffness: 180,
 damping: 22,
 }}
 className={`glass-card-3d p-4 md:p-5 bg-gradient-to-br ${card.color}`}
 >
 <div className="flex items-center justify-between mb-2">
 <Icon className="w-5 h-5 text-[var(--color-primary)]" />
 {card.key === "liveSessions" && (data?.liveSessions || 0) > 0 && (
 <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
 )}
 </div>
 <p className="text-xs text-[var(--color-subtle-foreground)] dark:text-gray-400">
 {card.label}
 </p>
 <p className="text-xl md:text-2xl font-bold text-muted-foreground mt-0.5">
 {loading ? (
 <span className="inline-block w-12 h-6 rounded bg-[var(--color-primary-muted)] animate-pulse" />
 ) : (
 getValue(card.key)
 )}
 </p>
 </motion.div>
 );
 })}
 </div>
 );
}

// BATCH_F3_APPLIED
