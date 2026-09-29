"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// WalletGateDialog — dual-tier recharge prompt with inline Razorpay
// ─────────────────────────────────────────────────────────────────────────────
// HARD tier (balance ≤ 0): blocks with distinct copy.
// SOFT tier (balance < rate): dismissible with a top-up CTA.
// On success, auto-resumes the original chat/session when resumeConsultantId
// is provided.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, ArrowRight, CheckCircle2, IndianRupee,
  Loader2, Sparkles, Wallet,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@zeal/ui";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/components/ui/toaster";

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

const PRESETS = [100, 500, 1000, 2000] as const;

export function WalletGateDialog({ open, onOpenChange, info }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Lazily resolve userId once when the dialog opens
  const ensureUserId = useCallback(async (): Promise<string | null> => {
    if (userId) return userId;
    try {
      const res = await fetch("/api/users/me/profile", { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as { user?: { id: string } };
      const id = data.user?.id ?? null;
      if (id) setUserId(id);
      return id;
    } catch { return null; }
  }, [userId]);

  const wallet = useWallet(userId);

  const isHardBlock = !info || info.balance <= 0;
  const deficit = info ? Math.max(0, info.required - info.balance) : 0;
  const suggested = useMemo(
    () => info ? Math.max(100, Math.ceil((deficit + info.required * 5) / 50) * 50) : 100,
    [info, deficit],
  );

  const recharge = useCallback(async (amount: number) => {
    setBusy(true);
    try {
      const uid = await ensureUserId();
      if (!uid) throw new Error("Please sign in again.");
      const order = await wallet.topUp(amount, crypto.randomUUID());
      const result = await wallet.openCheckout(order, `Top up ₹${amount}`);
      if (!result?.verified) {
        toast({ title: "Payment cancelled", variant: "default" });
        return;
      }
      setSucceeded(true);
      toast({ title: `₹${amount} added`, variant: "success" });
      setTimeout(() => {
        onOpenChange(false);
        setSucceeded(false);
        if (info?.consultantId) {
          router.push(`/chat?consultantId=${encodeURIComponent(info.consultantId)}`);
        }
      }, 1200);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Top-up failed",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }, [ensureUserId, wallet, info, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border">
        <AnimatePresence mode="wait">
          {succeeded ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-black text-foreground">Funds added</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Resuming your conversation…
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={isHardBlock ? "hard" : "soft"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <DialogHeader>
                <div className="flex justify-center mb-3">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    isHardBlock
                      ? "bg-rose-500/10 border border-rose-500/20"
                      : "bg-amber-500/10 border border-amber-500/20"
                  }`}>
                    {isHardBlock
                      ? <Wallet className="w-8 h-8 text-rose-400" />
                      : <AlertCircle className="w-8 h-8 text-amber-400" />}
                  </div>
                </div>
                <DialogTitle className="text-foreground text-lg font-bold text-center">
                  {isHardBlock ? "Add funds to start" : "Low balance"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-sm mt-2 text-center leading-relaxed">
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
                <div className="mt-5 p-4 rounded-xl bg-white/[0.03] border border-border space-y-2">
                  <Row label="Current balance" value={`₹${info.balance.toFixed(2)}`} />
                  <Row label="Required per minute" value={`₹${info.required.toFixed(2)}`} />
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="text-[var(--color-primary)] text-xs font-black">
                      Suggested top-up
                    </span>
                    <span className="text-[var(--color-primary)] text-xs font-black font-mono">
                      ₹{suggested.toFixed(0)}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-4 gap-2">
                {PRESETS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => void recharge(amt)}
                    disabled={busy}
                    className="py-3 rounded-xl bg-surface-raised hover:bg-[var(--color-primary)]/10
                               border border-border hover:border-[var(--color-primary)]/40
                               text-xs font-black font-mono
                               transition-all active:scale-95 disabled:opacity-40"
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              <button
                onClick={() => void recharge(suggested)}
                disabled={busy}
                className="mt-3 w-full py-3.5 rounded-2xl
                           bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                           text-white text-sm font-black
                           shadow-lg shadow-[var(--color-primary-hover)]/20
                           hover:opacity-95 active:scale-[0.98] transition-all
                           disabled:opacity-50
                           flex items-center justify-center gap-2"
              >
                {busy ? (
                  <><Loader2 size={15} className="animate-spin" /> Opening checkout…</>
                ) : (
                  <><Sparkles size={15} /> Add ₹{suggested.toFixed(0)} <ArrowRight size={13} /></>
                )}
              </button>

              <button
                onClick={() => onOpenChange(false)}
                disabled={busy}
                className="mt-2 w-full py-2.5 text-xs font-bold text-muted-foreground
                           hover:text-foreground transition-colors"
              >
                Cancel
              </button>

              <p className="text-[10px] text-muted-foreground text-center mt-3 flex items-center justify-center gap-1">
                <IndianRupee size={9} /> Funds are escrow-protected. Unused balance is refundable.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-mono">{value}</span>
    </div>
  );
}
