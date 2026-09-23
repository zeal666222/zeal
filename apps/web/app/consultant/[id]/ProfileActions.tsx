// ZEAL_PHASE2_V1
"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// ProfileActions — Chat + Book CTAs for the consultant profile page
// ─────────────────────────────────────────────────────────────────────────────
// • Chat  → startChatFlow (auth → online → wallet → conversation → navigate)
// • Book  → /booking?consultantId={id}
// • Realtime: subscribes to consultants:live for status changes
// • Wallet gate dialog rendered inline
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Loader2, MessageCircle } from "lucide-react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";
import { startChatFlow, type LowBalanceInfo } from "@/lib/chat/start-chat-flow";
import { WalletGateDialog } from "@/components/billing/WalletGateDialog";

interface Props {
  consultantId: string;
  consultantName: string;
  perMinuteRate: number;
  isOnline: boolean;
  isAI: boolean;
}

export function ProfileActions({
  consultantId,
  consultantName,
  perMinuteRate,
  isOnline: initialOnline,
  isAI,
}: Props) {
  const router = useRouter();
  const [online, setOnline] = useState(initialOnline || isAI);
  const [busy, setBusy] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateInfo, setGateInfo] = useState<LowBalanceInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Realtime: presence
  useChannel<
    BroadcastChange<{ consultantId?: string; is_online?: boolean; userId?: string }>
  >({
    channel: channels.consultantsLive(),
    event: "*",
    onMessage: useCallback(
      (p) => {
        const payload = p as unknown as {
          consultantId?: string;
          is_online?: boolean;
          record?: { userId?: string; is_online?: boolean };
        };
        const id = payload.consultantId ?? payload.record?.userId;
        const status = payload.is_online ?? payload.record?.is_online;
        if (id === consultantId && typeof status === "boolean") {
          setOnline(status || isAI);
        }
      },
      [consultantId, isAI],
    ),
  });

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const handleChat = useCallback(async () => {
    if (!online && !isAI) {
      showToast(`${consultantName} is currently offline.`);
      return;
    }
    await startChatFlow(consultantId, {
      router,
      onLoading: setBusy,
      onLowBalance: (info) => {
        setGateInfo(info);
        setGateOpen(true);
      },
      onOffline: ({ consultantName: n }) =>
        showToast(`${n} is currently offline.`),
      onError: (msg) => showToast(msg),
    });
  }, [consultantId, consultantName, isAI, online, router]);

  const handleBook = useCallback(() => {
    router.push(`/booking?consultantId=${encodeURIComponent(consultantId)}`);
  }, [consultantId, router]);

  return (
    <>
      <div className="flex flex-wrap gap-3 mt-6">
        <button
          type="button"
          onClick={handleChat}
          disabled={busy || (!online && !isAI)}
          className={`inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black text-sm transition-all active:scale-[0.97] ${
            !online && !isAI
              ? "bg-white/5 text-slate-500 cursor-not-allowed"
              : "bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white shadow-xl shadow-[#533AFD]/25 hover:opacity-95"
          }`}
        >
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Connecting…
            </>
          ) : (
            <>
              <MessageCircle size={16} />
              {isAI ? "Chat with AI" : online ? "Chat now" : "Offline"}
            </>
          )}
        </button>

        {!isAI && (
          <button
            type="button"
            onClick={handleBook}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl glass-luxury glass-luxury-hover text-white font-black text-sm"
          >
            <Calendar size={16} />
            Book session · ₹{perMinuteRate}/min
          </button>
        )}
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
