"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store/appStore";
import { useRealtime } from "./useRealtime";

export function useWallet() {
  const wallet = useAppStore((s) => s.wallet);
  const setWallet = useAppStore((s) => s.setWallet);
  const user = useAppStore((s) => s.user);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet"],
    queryFn: async () => {
      const res = await fetch("/api/wallet/balance");
      if (!res.ok) throw new Error("Failed to fetch wallet");
      return res.json();
    },
    staleTime: 60_000,
  });

  if (data?.wallet && !wallet) {
    setWallet(data.wallet);
  }

  // Realtime — channel name MUST match server publish target
  useRealtime<{ balance?: number }>(
    user?.id ? `user:${user.id}` : null,
    "wallet:updated",
    (payload) => {
      if (typeof payload?.balance === "number") {
        setWallet({ balance: payload.balance } as never);
        queryClient.invalidateQueries({ queryKey: ["wallet"] });
      }
    },
  );

  const topUp = useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) throw new Error("Top-up failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });

  const transactionsQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const res = await fetch("/api/wallet/transactions");
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
  });

  return {
    wallet,
    isLoading,
    error,
    topUp: topUp.mutate,
    topUpPending: topUp.isPending,
    transactions: transactionsQuery.data?.items || [],
    transactionsLoading: transactionsQuery.isLoading,
  };
}
