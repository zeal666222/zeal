"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Users, Compass, Star, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { startChatFlow } from "@/lib/chat/start-chat-flow";

interface Consultant {
  id: string;
  name: string;
  avatar_url: string | null;
  isAI: boolean;
  is_online: boolean;
  perMinuteRate: number | null;
  rating: number | null;
  category: string | null;
}

interface Service {
  name: string;
  slug: string;
  icon: string;
}

const FREE_SERVICES: Service[] = [
  { name: "Daily Horoscope", slug: "horoscope", icon: "✨" },
  { name: "Kundali Analysis", slug: "kundali", icon: "🪷" },
  { name: "Tarot Reading", slug: "tarot", icon: "🎴" },
  { name: "Numerology", slug: "numerology", icon: "🔢" },
  { name: "Palmistry", slug: "palmistry", icon: "🤚" },
  { name: "Dream Analysis", slug: "dream", icon: "🌙" },
];

export function ChatWelcomeSuggestions({ isAI }: { isAI: boolean }) {
  const router = useRouter();
  const [aiConsultants, setAiConsultants] = useState<Consultant[]>([]);
  const [realConsultants, setRealConsultants] = useState<Consultant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/explore/consultants?limit=6", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { consultants: Consultant[] };
        if (cancelled) return;
        const all = data.consultants ?? [];
        setAiConsultants(all.filter((c) => c.isAI).slice(0, 3));
        setRealConsultants(all.filter((c) => !c.isAI && c.is_online).slice(0, 3));
      } catch {
        // Non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleConsultantChat = async (consultantId: string, consultantName: string) => {
    await startChatFlow(consultantId, {
      router,
      onLowBalance: () => {},
      onOffline: () => {},
      onError: () => {},
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-8 h-8 rounded-full bg-surface-sunken border border-border flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-muted-foreground animate-pulse" />
        </div>
        <p className="text-xs text-muted-foreground font-medium">Loading suggestions…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-4 px-2">
      {/* Free Services */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Compass size={14} className="text-[var(--color-primary)]" />
          <span className="text-xs font-black uppercase tracking-wider text-foreground">
            Free Services
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {FREE_SERVICES.map((service) => (
            <motion.button
              key={service.slug}
              type="button"
              onClick={() => router.push(`/services/${service.slug}`)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface border border-border hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 transition-all text-left group"
            >
              <span className="text-lg">{service.icon}</span>
              <span className="text-[11px] font-bold text-foreground group-hover:text-[var(--color-primary)] transition-colors">
                {service.name}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* AI Consultants */}
      {aiConsultants.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-[var(--color-primary)]" />
            <span className="text-xs font-black uppercase tracking-wider text-foreground">
              AI Consultants
            </span>
          </div>
          <div className="space-y-2">
            {aiConsultants.map((consultant) => (
              <motion.button
                key={consultant.id}
                type="button"
                onClick={() => void handleConsultantChat(consultant.id, consultant.name)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface border border-border hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 transition-all text-left group"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] flex items-center justify-center text-white text-xs font-black shrink-0">
                  {consultant.avatar_url ? (
                    <img src={consultant.avatar_url} alt={consultant.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    consultant.name.charAt(0)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground group-hover:text-[var(--color-primary)] transition-colors truncate">
                    {consultant.name}
                  </p>
                  {consultant.category && (
                    <p className="text-[10px] text-muted-foreground font-medium truncate">
                      {consultant.category}
                    </p>
                  )}
                </div>
                {consultant.rating && (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
                    <Star size={10} fill="currentColor" />
                    {consultant.rating.toFixed(1)}
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Real Consultants */}
      {realConsultants.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-emerald-500" />
            <span className="text-xs font-black uppercase tracking-wider text-foreground">
              Online Consultants
            </span>
          </div>
          <div className="space-y-2">
            {realConsultants.map((consultant) => (
              <motion.button
                key={consultant.id}
                type="button"
                onClick={() => void handleConsultantChat(consultant.id, consultant.name)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface border border-border hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all text-left group"
              >
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                    {consultant.avatar_url ? (
                      <img src={consultant.avatar_url} alt={consultant.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      consultant.name.charAt(0)
                    )}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground group-hover:text-emerald-500 transition-colors truncate">
                    {consultant.name}
                  </p>
                  {consultant.perMinuteRate && (
                    <p className="text-[10px] text-muted-foreground font-medium">
                      ₹{consultant.perMinuteRate}/min
                    </p>
                  )}
                </div>
                {consultant.rating && (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
                    <Star size={10} fill="currentColor" />
                    {consultant.rating.toFixed(1)}
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state message */}
      {aiConsultants.length === 0 && realConsultants.length === 0 && (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground font-medium">
            {isAI ? "Ask me anything about astrology, life, or your concerns." : "Say hello to start the conversation."}
          </p>
        </div>
      )}
    </div>
  );
}
