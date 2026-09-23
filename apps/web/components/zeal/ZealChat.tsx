// ZEAL_PHASE2_V1
"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// ZealChat — AI concierge with inline consultant recommendations
// ─────────────────────────────────────────────────────────────────────────────
// • Full-width luxury glass panel
// • User/assistant bubbles
// • Concierge responses render ConsultantRecommendationCard inline
// • Wallet gate integrated via startChatFlow
// • Quick prompts when empty
// • Auto-scroll + reduced-motion aware
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Send, Sparkles } from "lucide-react";
import { startChatFlow, type LowBalanceInfo } from "@/lib/chat/start-chat-flow";
import { WalletGateDialog } from "@/components/billing/WalletGateDialog";
import {
  ConsultantRecommendationCard,
  type RecommendationConsultant,
} from "./ConsultantRecommendationCard";

interface Recommendation {
  response: string;
  categoryId: string;
  categoryName: string;
  reason?: string;
  consultants: RecommendationConsultant[];
  aiConsultants: RecommendationConsultant[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
  recommendation?: Recommendation;
}

const QUICK_PROMPTS = [
  { label: "💼 Career guidance", value: "I need clarity on my career path" },
  { label: "💕 Relationships", value: "I'm navigating a relationship challenge" },
  { label: "🌟 Vedic astrology", value: "I want a Vedic birth chart reading" },
  { label: "🧘 Peace & calm", value: "I need help managing anxiety" },
];

export function ZealChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello. I'm Zeal — tell me what you're looking for, and I'll find the right guide for you.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateInfo, setGateInfo] = useState<LowBalanceInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loading]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const send = useCallback(async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai?task=concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error || `HTTP ${res.status}`,
        );
      }

      const data = (await res.json()) as Recommendation & { success: boolean };
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          recommendation: {
            response: data.response,
            categoryId: data.categoryId,
            categoryName: data.categoryName,
            reason: data.reason,
            consultants: data.consultants ?? [],
            aiConsultants: data.aiConsultants ?? [],
          },
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I'm having trouble connecting right now. Could you try again in a moment?",
        },
      ]);
      console.error("[ZealChat] error:", err);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const handleChat = useCallback(
    async (consultantId: string) => {
      await startChatFlow(consultantId, {
        router,
        onLowBalance: (info) => {
          setGateInfo(info);
          setGateOpen(true);
        },
        onOffline: ({ consultantName }) =>
          showToast(`${consultantName} is currently offline.`),
        onError: showToast,
      });
    },
    [router],
  );

  const isStreamingResponse = loading;

  return (
    <>
      <div className="glass-luxury rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#9D7DC5] to-[#533AFD] flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-white">Ask Zeal</p>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Online · powered by Agnes + Groq
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {messages.map((m, i) => (
            <div key={i} className="space-y-3">
              <div
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] text-white rounded-br-sm"
                      : "bg-white/5 border border-white/10 text-slate-200 rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>

              {m.recommendation &&
                (m.recommendation.consultants.length > 0 ||
                  m.recommendation.aiConsultants.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-[90%]">
                    {m.recommendation.aiConsultants.map((c, idx) => (
                      <ConsultantRecommendationCard
                        key={c.id}
                        consultant={{ ...c, isAI: true }}
                        reason={m.recommendation?.reason}
                        index={idx}
                        onChat={handleChat}
                      />
                    ))}
                    {m.recommendation.consultants.map((c, idx) => (
                      <ConsultantRecommendationCard
                        key={c.id}
                        consultant={c}
                        reason={m.recommendation?.reason}
                        index={idx}
                        onChat={handleChat}
                      />
                    ))}
                  </div>
                )}
            </div>
          ))}

          {isStreamingResponse && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-white/5 border border-white/10">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-luxury-gold)] animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-luxury-gold)] animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-luxury-gold)] animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick prompts */}
        {messages.length === 1 && (
          <div className="px-6 pb-3 flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => send(p.value)}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300 hover:border-[var(--color-luxury-gold)]/40 hover:text-white transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-white/5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you need..."
              maxLength={500}
              disabled={loading}
              className="flex-1 bg-white/5 border border-white/10 rounded-full px-5 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-[var(--color-luxury-gold)] transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Send"
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shrink-0 ${
                input.trim() && !loading
                  ? "bg-gradient-to-br from-[#9D7DC5] to-[#533AFD] text-white active:scale-95"
                  : "bg-white/5 text-slate-500 cursor-not-allowed"
              }`}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} className="ml-0.5" />
              )}
            </button>
          </form>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-2xl glass-luxury text-sm font-bold text-white shadow-2xl">
          {toast}
        </div>
      )}

      <WalletGateDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        info={gateInfo}
      />
    </>
  );
}
