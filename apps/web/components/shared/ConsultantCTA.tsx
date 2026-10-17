"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Loader2 } from "lucide-react";
import Link from "next/link";

interface AvailableConsultant {
  id: string;
  name: string;
  avatar: string | null;
  category: string;
  perMinuteRate: number | null;
  rating: number;
  isOnline: boolean;
  specialties: string[];
}

interface ConsultantCTAProps {
  category: string;
  title?: string;
  description?: string;
  accentColor?: string;
  limit?: number;
  active?: boolean;
}

export default function ConsultantCTA({
  category,
  title = "Want a deeper reading?",
  description = "Connect with expert consultants for personalized guidance.",
  accentColor = "amber",
  limit = 4,
  active = true,
}: ConsultantCTAProps) {
  const [consultants, setConsultants] = useState<AvailableConsultant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    fetch(`/api/explore/consultants?category=${encodeURIComponent(category)}&online=true&limit=${limit}`)
      .then((r) => r.json())
      .then((data) => {
        const items = (data.consultants ?? data.items ?? (Array.isArray(data) ? data : [])) as AvailableConsultant[];
        setConsultants(items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category, limit, active]);

  if (!active) return null;

  const colorMap: Record<string, { text: string; border: string; bg: string; badge: string }> = {
    amber: { text: "text-amber-400", border: "hover:border-amber-500/30", bg: "from-amber-500/20 to-orange-500/20", badge: "text-amber-400" },
    purple: { text: "text-purple-400", border: "hover:border-purple-500/30", bg: "from-purple-500/20 to-indigo-500/20", badge: "text-purple-400" },
    rose: { text: "text-rose-400", border: "hover:border-rose-500/30", bg: "from-rose-500/20 to-pink-500/20", badge: "text-rose-400" },
    indigo: { text: "text-indigo-400", border: "hover:border-indigo-500/30", bg: "from-indigo-500/20 to-blue-500/20", badge: "text-indigo-400" },
    primary: { text: "text-[var(--color-primary)]", border: "hover:border-[var(--color-primary)]/30", bg: "from-[var(--color-primary)]/20 to-amber-500/20", badge: "text-[var(--color-primary)]" },
  };

  const colors = colorMap[accentColor] ?? colorMap["amber"]!;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 22 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2">
        <Users size={14} className={colors.text} />
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={20} className={`${colors.text} animate-spin`} />
        </div>
      ) : consultants.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {consultants.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ scale: 1.02, y: -2 }}
            >
              <Link
                href={`/consultant/${c.id}`}
                className={`block p-3 rounded-2xl bg-surface/80 border border-border/60 ${colors.border} transition-colors`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${colors.bg} flex items-center justify-center text-xs font-bold ${colors.badge}`}>
                    {c.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{c.specialties?.[0] ?? c.category}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-amber-400">★ {c.rating.toFixed(1)}</span>
                  {c.perMinuteRate && (
                    <span className="text-muted-foreground">₹{c.perMinuteRate}/min</span>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">
          No experts online right now
        </p>
      )}
    </motion.div>
  );
}
