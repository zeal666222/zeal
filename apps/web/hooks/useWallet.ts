"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// useWallet — Enterprise realtime wallet
// ─────────────────────────────────────────────────────────────────────────────
// Invariants:
//   • Full WalletState (balance, escrow, pendingIn, pendingOut, blocked)
//   • State channel → refetch (never trust optimistic math)
//   • Ledger channel → prepend entries (hint only)
//   • Reconnect reconciliation
//   • Idempotent refetch (in-flight guard)
// ═══════════════════════════════════════════════════════════════════════════════

import {useCallback, useEffect, useRef, useState} from "react";
import {useChannel, useConnection, channels, type BroadcastChange} from "@zeal/realtime";

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
  referenceId?: string | null;
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

const LEDGER_PAGE_SIZE = 30;

export function useWallet(userId: string | null) {
  const [wallet, setWallet] = useState<WalletState>(EMPTY_WALLET);
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const connectionState = useConnection();
  const wasDisconnectedRef = useRef(false);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const [balRes, txRes] = await Promise.all([
        fetch("/api/wallet/balance", { cache: "no-store" }),
        fetch(`/api/wallet/transactions?limit=${LEDGER_PAGE_SIZE}`, { cache: "no-store" }),
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
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet fetch failed");
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    refresh().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, refresh]);

  // Reconnect reconciliation
  useEffect(() => {
    if (!userId) return;
    if (connectionState === "connected" && wasDisconnectedRef.current) {
      void refresh();
    }
    wasDisconnectedRef.current = connectionState !== "connected";
  }, [connectionState, userId, refresh]);

  // State channel → full refetch
  useChannel<BroadcastChange<WalletRow>>({
    channel: userId ? channels.userWallet(userId) : null,
    event: "*",
    onMessage: () => { void refresh(); },
  });

  // Ledger channel → prepend
  useChannel<BroadcastChange<LedgerEntry>>({
    channel: userId ? channels.userWalletLedger(userId) : null,
    event: "*",
    onMessage: (payload) => {
      if (payload?.type !== "INSERT") return;
      const entry = payload.record;
      if (!entry?.id) return;
      setTransactions((prev) => {
        if (prev.some((t) => t.id === entry.id)) return prev;
        return [entry, ...prev].slice(0, LEDGER_PAGE_SIZE * 2);
      });
    },
  });

  return {
    wallet,
    balance: wallet.balance,
    transactions,
    loading,
    error,
    refresh,
    total: wallet.balance + wallet.escrow + wallet.pendingIn - wallet.pendingOut,
    available: wallet.balance,
    locked: wallet.escrow + wallet.pendingOut + wallet.blocked,
  };
}
