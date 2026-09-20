"use client";
import {useCallback, useEffect, useState} from "react";
import {useChannel, channels} from "@zeal/realtime";
import type { BroadcastChange, LedgerEntry, WalletState } from "@/types/chat";

export function useWalletLedger(userId: string | null) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [wallet, setWallet] = useState<WalletState>({ balance: 0, escrow: 0, pendingIn: 0, pendingOut: 0, blocked: 0 });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const [balRes, txRes] = await Promise.all([
        fetch("/api/wallet/balance", { cache: "no-store" }),
        fetch("/api/wallet/transactions?limit=30", { cache: "no-store" }),
      ]);
      if (balRes.ok) { const b = await balRes.json(); if (b?.wallet) setWallet(b.wallet); }
      if (txRes.ok) { const t = await txRes.json(); if (Array.isArray(t?.transactions)) setEntries(t.transactions); }
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useChannel<BroadcastChange<WalletState>>({
    channel: userId ? channels.userWallet(userId) : null,
    event: "*",
    onMessage: (p) => { if (p?.record?.balance !== undefined) setWallet(p.record as WalletState); },
  });

  useChannel<BroadcastChange<LedgerEntry>>({
    channel: userId ? channels.userWalletLedger(userId) : null,
    event: "*",
    onMessage: (p) => {
      if (p?.type !== "INSERT") return;
      const entry = p.record;
      if (!entry?.id) return;
      setEntries((prev) => prev.some((e) => e.id === entry.id) ? prev : [entry, ...prev].slice(0, 60));
    },
  });

  return { entries, wallet, loading, refresh };
}
