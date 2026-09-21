"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Phone } from "lucide-react";

interface Props {
  consultantId?: string;
  aiConsultantId?: string;
  conversationId?: string;
  rate: number;
  label?: string;
  className?: string;
}

export function StartSessionButton({
  consultantId, aiConsultantId, conversationId, rate,
  label = "Start Session",
  className = "",
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultantId, aiConsultantId, conversationId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (body as { error?: string }).error ?? "Could not start session.";
        throw new Error(msg);
      }
      const { sessionId } = body as { sessionId: string };
      const target = conversationId
        ? `/chat/${conversationId}?session=${sessionId}`
        : `/chat/new?session=${sessionId}&consultantId=${consultantId ?? aiConsultantId ?? ""}`;
      router.push(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start.");
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className={`flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:shadow-emerald-600/20 disabled:opacity-50 transition-all ${className}`}
      >
        {loading ? (
          <><Loader2 size={15} className="animate-spin" /> Starting…</>
        ) : (
          <><Phone size={15} /> {label}{rate > 0 && ` · ₹${rate}/min`}</>
        )}
      </button>
      {error && <p className="mt-2 text-xs text-rose-400 font-medium">{error}</p>}
    </div>
  );
}
