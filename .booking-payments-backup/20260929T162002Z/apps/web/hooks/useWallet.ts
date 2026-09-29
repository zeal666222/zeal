"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// apps/web/hooks/useWallet.ts
// ─────────────────────────────────────────────────────────────────────────────
// Enterprise realtime wallet:
//   • Full WalletState (balance, escrow, pendingIn, pendingOut, blocked)
//   • topUp(amount)          → creates Razorpay order, returns { orderId, keyId }
//   • openCheckout(order)    → loads checkout.js, opens modal, verifies on success
//   • Reconnect reconciliation + idempotent refetch
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useChannel, useConnection, channels,
  type BroadcastChange,
} from "@zeal/realtime";

// ─── Razorpay global ─────────────────────────────────────────────────────────
interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
  prefill?: { name?: string; email?: string; contact?: string };
}
interface RazorpayInstance { open: () => void; close: () => void; }
type RazorpayCtor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window { Razorpay?: RazorpayCtor; }
}

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let razorpayLoader: Promise<boolean> | null = null;

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayLoader) return razorpayLoader;

  razorpayLoader = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_SCRIPT}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const s = document.createElement("script");
    s.src = RAZORPAY_SCRIPT;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
  return razorpayLoader;
}

// ─── Types ───────────────────────────────────────────────────────────────────
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
interface TopUpOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}
export interface CheckoutSuccess extends RazorpaySuccessResponse {
  verified: boolean;
}

const EMPTY_WALLET: WalletState = {
  balance: 0, escrow: 0, pendingIn: 0, pendingOut: 0, blocked: 0,
};
const LEDGER_PAGE_SIZE = 30;

// ─── The hook ────────────────────────────────────────────────────────────────
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
        const b = (await balRes.json()) as { wallet?: WalletRow };
        const w = b.wallet;
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
        const t = (await txRes.json()) as { transactions?: LedgerEntry[] };
        if (Array.isArray(t.transactions)) setTransactions(t.transactions);
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
    void refresh().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, refresh]);

  useEffect(() => {
    if (!userId) return;
    if (connectionState === "connected" && wasDisconnectedRef.current) void refresh();
    wasDisconnectedRef.current = connectionState !== "connected";
  }, [connectionState, userId, refresh]);

  useChannel<BroadcastChange<WalletRow>>({
    channel: userId ? channels.userWallet(userId) : null,
    event: "*",
    onMessage: () => { void refresh(); },
  });
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

  // ─── topUp: create Razorpay order ────────────────────────────────────────
  const topUp = useCallback(
    async (amount: number, idempotencyKey?: string): Promise<TopUpOrder> => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers,
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      return (await res.json()) as TopUpOrder;
    },
    [],
  );

  // ─── verify: server-side signature check ─────────────────────────────────
  const verifyPayment = useCallback(
    async (response: RazorpaySuccessResponse): Promise<boolean> => {
      const res = await fetch("/api/wallet/topup?action=verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(response),
      });
      if (!res.ok) return false;
      await refresh();
      return true;
    },
    [refresh],
  );

  // ─── openCheckout: one-shot modal ────────────────────────────────────────
  const openCheckout = useCallback(
    async (order: TopUpOrder, description = "Wallet top-up"): Promise<CheckoutSuccess | null> => {
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) throw new Error("Could not load Razorpay");
      return new Promise<CheckoutSuccess | null>((resolve) => {
        const rzp = new window.Razorpay!({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: "Zeal",
          description,
          order_id: order.orderId,
          theme: { color: "#9D7DC5" },
          handler: (response) => {
            void (async () => {
              const verified = await verifyPayment(response);
              resolve({ ...response, verified });
            })();
          },
          modal: {
            ondismiss: () => resolve(null),
          },
        });
        rzp.open();
      });
    },
    [verifyPayment],
  );

  return {
    wallet,
    balance: wallet.balance,
    transactions,
    loading,
    error,
    refresh,
    topUp,
    verifyPayment,
    openCheckout,
    total: wallet.balance + wallet.escrow + wallet.pendingIn - wallet.pendingOut,
    available: wallet.balance,
    locked: wallet.escrow + wallet.pendingOut + wallet.blocked,
  };
}
