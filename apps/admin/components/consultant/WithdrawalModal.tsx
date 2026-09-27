"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, IndianRupee, Loader2, X } from "lucide-react";

interface Props {
  open: boolean;
  balance: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function WithdrawalModal({ open, balance, onClose, onSuccess }: Props) {
  const [amount, setAmount] = useState(100);
  const [upiId, setUpiId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (amount < 100) { setError("Minimum ₹100"); return; }
    if (amount > balance) { setError("Insufficient balance"); return; }
    if (!upiId || upiId.length < 3) { setError("Valid UPI ID required"); return; }

    setSubmitting(true); setError(null);
    try {
      const res = await fetch("/api/consultant/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, upiId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Withdrawal failed");
      }
      setDone(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdrawal failed");
    } finally { setSubmitting(false); }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-surface border border-border rounded-3xl p-6 shadow-2xl">
          {done ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-black text-foreground">Withdrawal Requested</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Awaiting admin approval. Usually processed within 24 hours.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-black text-foreground">Withdraw Funds</h3>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-raised" aria-label="Close">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-surface-sunken border border-border mb-5">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Available Balance
                </p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1 flex items-center">
                  <IndianRupee size={20} /> {balance.toFixed(2)}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                    Amount (₹)
                  </label>
                  <input type="number" min={100} max={balance} value={amount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-surface-raised border border-border rounded-xl text-foreground font-mono focus:border-emerald-500 outline-none" />
                  <div className="flex gap-2 mt-2">
                    {[500, 1000, Math.floor(balance)].map((amt) =>
                      amt >= 100 && amt <= balance && (
                        <button key={amt} onClick={() => setAmount(amt)}
                          className="px-3 py-1 rounded-lg bg-surface-raised hover:bg-surface-overlay text-xs font-bold text-muted-foreground">
                          ₹{amt}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                    UPI ID
                  </label>
                  <input type="text" value={upiId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUpiId(e.target.value)}
                    placeholder="yourname@upi"
                    className="w-full px-4 py-3 bg-surface-raised border border-border rounded-xl text-foreground focus:border-emerald-500 outline-none" />
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
                    {error}
                  </div>
                )}

                <button onClick={submit} disabled={submitting}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : "Request Withdrawal"}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
