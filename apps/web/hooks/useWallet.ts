"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// useWallet — Real-time wallet + ledger
// ─────────────────────────────────────────────────────────────────────────────
// Design invariants (enterprise-grade):
//   • Subscribe to the FULL Wallet row, not just balance. Balance, escrow,
//     pendingIn/pendingOut, blocked all update in the same transaction —
//     partial subscription causes visible UI inconsistency.
//   • Never accept optimistic balance — always refetch ledger from server.
//   • Refetch on any wallet broadcast (single source of truth = DB).
//   • Idempotency: the server-side RPC guarantees exactly-once mutation.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";

export interface WalletState {
  balance: number;
  escrow: number;
  pendingIn: number;
  pendingOut: number;
  blocked: number;
}

export interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  balance: number;
  description: string;
  createdAt: string;
}

interface WalletRow {
  userId?: string;
  balance?: number;
  escrow?: number;
  pendingIn?: number;
  pendingOut?: number;
  blocked?: number;
}

const EMPTY_WALLET: WalletState = {
  balance: 0, escrow: 0, pendingIn: 0, pendingOut: 0, blocked: 0,
};

export function useWallet(userId: string | null) {
  const [wallet, setWallet] = useState<WalletState>(EMPTY_WALLET);
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [balRes, txRes] = await Promise.all([
        fetch("/api/wallet/balance", { cache: "no-store" }),
        fetch("/api/wallet/transactions?limit=20", { cache: "no-store" }),
      ]);
      if (balRes.ok) {
        const b = await balRes.json();
        const w = b?.wallet;
        if (w) {
          setWallet({
            balance: Number(w.balance ?? 0),
            escrow: Number(w.escrow ?? 0),
            pendingIn: Number(w.pendingIn ?? 0),
            pendingOut: Number(w.pendingOut ?? 0),
            blocked: Number(w.blocked ?? 0),
          });
        }
      }
      if (txRes.ok) {
        const t = await txRes.json();
        if (Array.isArray(t?.transactions)) setTransactions(t.transactions);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    refresh().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, refresh]);

  // Full-row subscription — any field change triggers a refetch
  useChannel<BroadcastChange<WalletRow>>({
    channel: userId ? channels.userWallet(userId) : null,
    event: "*",
    onMessage: () => { void refresh(); },
  });

  return {
    // Full state (preferred)
    wallet,
    // Backward-compatible scalar
    balance: wallet.balance,
    transactions,
    loading,
    refresh,
  };
}
