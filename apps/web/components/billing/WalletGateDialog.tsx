// ZEAL_PHASE2_V1
"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// WalletGateDialog — dual-tier recharge prompt
// ─────────────────────────────────────────────────────────────────────────────
// HARD tier (balance ≤ 0): blocks with distinct copy, "Add ₹{deficit}" CTA.
// SOFT tier (balance < rate): dismissible with "Top up" primary CTA.
// Both route to /wallet?resume={consultantId} so top-up auto-resumes the chat.
// ═══════════════════════════════════════════════════════════════════════════════

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowRight, IndianRupee, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@zeal/ui";

export interface WalletGateInfo {
  balance: number;
  required: number;
  consultantName: string;
  consultantId: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  info: WalletGateInfo | null;
}

export function WalletGateDialog({ open, onOpenChange, info }: Props) {
  const router = useRouter();

  const isHardBlock = !info || info.balance <= 0;
  const deficit = info ? Math.max(0, info.required - info.balance) : 0;
  const suggested = info
    ? Math.max(100, Math.ceil((deficit + info.required * 5) / 50) * 50)
    : 100;

  const handleRecharge = () => {
    if (!info) return;
    onOpenChange(false);
    router.push(`/wallet?resume=${encodeURIComponent(info.consultantId)}&amount=${suggested}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-luxury max-w-md border-white/10">
        <AnimatePresence mode="wait">
          <motion.div
            key={isHardBlock ? "hard" : "soft"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <DialogHeader>
              <div className="flex justify-center mb-3">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    isHardBlock
                      ? "bg-rose-500/10 border border-rose-500/20"
                      : "bg-amber-500/10 border border-amber-500/20"
                  }`}
                >
                  {isHardBlock ? (
                    <Wallet className="w-8 h-8 text-rose-400" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-amber-400" />
                  )}
                </div>
              </div>
              <DialogTitle className="text-white text-lg font-bold text-center">
                {isHardBlock ? "Add funds to start chatting" : "Low balance"}
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-sm mt-2 text-center leading-relaxed">
                {info
                  ? `Chat with ${info.consultantName} costs ₹${info.required.toFixed(0)}/min. ${
                      isHardBlock
                        ? "Your wallet is empty."
                        : `You have ₹${info.balance.toFixed(2)} available.`
                    }`
                  : "Your wallet needs funds to continue."}
              </DialogDescription>
            </DialogHeader>

            {info && (
              <div className="mt-5 p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Current balance</span>
                  <span className="text-white font-mono">
                    ₹{info.balance.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Required per minute</span>
                  <span className="text-white font-mono">
                    ₹{info.required.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-2 border-t border-white/5">
                  <span className="text-[var(--color-luxury-gold)] font-bold">
                    Suggested top-up
                  </span>
                  <span className="text-[var(--color-luxury-gold)] font-bold font-mono">
                    ₹{suggested.toFixed(0)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10
                           text-slate-300 text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecharge}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#9D7DC5] to-[#533AFD]
                           text-white text-sm font-bold shadow-lg shadow-[#533AFD]/20
                           hover:opacity-95 active:scale-[0.98] transition-all
                           flex items-center justify-center gap-1.5"
              >
                <IndianRupee size={14} />
                Add ₹{suggested.toFixed(0)}
                <ArrowRight size={13} />
              </button>
            </div>

            <p className="text-[10px] text-slate-500 text-center mt-4">
              Funds are escrow-protected. Unused balance is always refundable.
            </p>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
