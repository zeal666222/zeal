'use client';
// ═══════════════════════════════════════════════════════════════════════════════
// /admin/wallet — platform ledger console
// ═══════════════════════════════════════════════════════════════════════════════
//
// Money-critical tool. It used to render the *acting admin's own* wallet and
// post a bare {amount} to /wallet/topup, whose schema requires an explicit
// target userId — so every top-up failed with 422 and the page silently
// reported "Top-up failed". Worse, the framing invited crediting the admin's
// own balance.
//
// This version is target-first, mirroring how the routes already work: pick a
// user, read their ledger, then credit or debit them with a mandatory reason.
// Both actions are confirmed, audited server-side, and surfaced live through
// the admin realtime channels.

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, ConfirmDialog } from '@zeal/ui';
import { toast } from '@/components/ui/toaster';
import { useChannel } from '@zeal/realtime';
import { channels } from '@zeal/realtime';
import { LoadingState } from '@/components/admin/shared/LoadingState';
import { EmptyState } from '@/components/admin/shared/EmptyState';
import { ErrorBoundary } from '@/components/admin/shared/ErrorBoundary';
import { LiveBusPanel } from '@/components/admin/dashboard/LiveBusPanel';
import {
  ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, RefreshCw, Search,
  ShieldAlert, Users, WalletIcon,
} from 'lucide-react';

interface LedgerWallet {
  id: string | null;
  balance: number;
  escrow: number;
  pendingIn: number;
  pendingOut: number;
  blocked: number;
  updatedAt: string | null;
}

interface LedgerUser {
  id: string;
  name: string | null;
  email: string;
  username: string | null;
  role: string | null;
}

interface WalletPayload {
  wallet: LedgerWallet;
  targetUserId: string;
  isTargeted: boolean;
  user: LedgerUser | null;
}

interface TxRow {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  createdAt: string;
  referenceId: string | null;
}

type AdjustmentKind = 'credit' | 'debit';

interface AdjustmentInput {
  kind: AdjustmentKind;
  amount: number;
  reason: string;
}

const inr = (n: number) =>
  `₹${(Number.isFinite(n) ? n : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function reasonErrorMessage(kind: AdjustmentKind, reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    return `A reason is required for ${kind === 'credit' ? 'credits' : 'debits'} (min 3 characters).`;
  }
  if (trimmed.length > 240) return 'Keep the reason under 240 characters.';
  return null;
}

function amountErrorMessage(amount: number, available: number, kind: AdjustmentKind): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter an amount greater than zero.';
  if (amount > 100_000) return 'Single adjustments are capped at ₹1,00,000.';
  if (kind === 'debit' && amount > available) {
    return `Cannot debit ${inr(amount)} — only ${inr(available)} is available.`;
  }
  return null;
}

function LedgerContent() {
  const queryClient = useQueryClient();

  // Target selection. `selected` is the user the console operates on; the search
  // list is only a picker.
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LedgerUser | null>(null);
  const [page, setPage] = useState(1);

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState<AdjustmentInput | null>(null);

  const usersQuery = useQuery<{
    users: LedgerUser[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>({
    queryKey: ['admin', 'users', 'ledger-search', search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '12' });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not load users');
      return res.json();
    },
  });

  const targetUserId = selected?.id;

  const walletQuery = useQuery<WalletPayload>({
    queryKey: ['admin', 'wallet', targetUserId ?? 'self'],
    queryFn: async () => {
      const qs = targetUserId ? `?userId=${encodeURIComponent(targetUserId)}` : '';
      const res = await fetch(`/api/admin/wallet${qs}`, { cache: 'no-store' });
      if (!res.status) throw new Error('Failed');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Could not load the wallet');
      }
      return res.json();
    },
    enabled: Boolean(targetUserId),
  });

  const ledgerQuery = useQuery<{ items: TxRow[] }>({
    queryKey: ['admin', 'transactions', targetUserId ?? 'self'],
    queryFn: async () => {
      const qs = targetUserId ? `?userId=${encodeURIComponent(targetUserId)}&limit=50` : '';
      const res = await fetch(`/api/admin/wallet/transactions${qs}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not load the ledger');
      return res.json();
    },
    enabled: Boolean(targetUserId),
  });

  const adjust = useMutation<{ newBalance?: number | null }, Error, AdjustmentInput>({
    mutationFn: async ({ kind, amount: value, reason: why }) => {
      const path = kind === 'credit' ? '/api/admin/wallet/topup' : '/api/admin/wallet/debit';
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUserId, amount: value, reason: why.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `${kind === 'credit' ? 'Credit' : 'Debit'} failed`);
      return body;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'wallet'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'transactions'] });
      setAmount('');
      setReason('');
      toast({
        title: variables.kind === 'credit' ? 'Wallet credited' : 'Wallet debited',
        description:
          data?.newBalance != null
            ? `New balance ${inr(data.newBalance)}.`
            : `Recorded against ${selected?.email ?? 'the selected user'}.`,
        variant: 'success',
      });
    },
    onError: (e) => {
      toast({ title: e.message || 'Adjustment rejected', variant: 'destructive' });
    },
  });

  const refreshAll = () => {
    void usersQuery.refetch();
    void walletQuery.refetch();
    void ledgerQuery.refetch();
  };

  // Any settlement, payout or credit anywhere on the platform repaints this
  // console without waiting for a poll. Polling stays as a low-frequency safety
  // net in case a broadcast is missed while the tab was asleep.
  useChannel({ channel: channels.adminPayments(), event: '*', onMessage: refreshAll });

  const parsedAmount = Number(amount);
  const available = walletQuery.data?.wallet.balance ?? 0;

  const validation = useMemo(() => {
    if (!targetUserId) return 'Select a user to adjust.';
    const amtErr = amountErrorMessage(parsedAmount, available, 'credit');
    if (amtErr) return amtErr;
    const rsnErr = reasonErrorMessage('credit', reason);
    if (rsnErr) return rsnErr;
    return null;
  }, [targetUserId, parsedAmount, available, reason]);

  const beginAdjust = (kind: AdjustmentKind) => {
    const amtErr = amountErrorMessage(parsedAmount, available, kind);
    if (amtErr) return toast({ title: amtErr, variant: 'destructive' });
    const rsnErr = reasonErrorMessage(kind, reason);
    if (rsnErr) return toast({ title: rsnErr, variant: 'destructive' });

    setConfirming({ kind, amount: parsedAmount, reason: reason.trim() });
  };

  const wallet = walletQuery.data?.wallet;

  return (
    <div className="space-y-5">
      <LiveBusPanel />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Target picker */}
        <Card className="glass-card-3d lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widest text-muted-foreground">
              <Users className="w-4 h-4" /> Choose account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Email, name or username"
                className="pl-9 glass border-border"
              />
            </div>

            {usersQuery.isLoading ? (
              <LoadingState />
            ) : usersQuery.isError ? (
              <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-400">
                {(usersQuery.error as Error).message}
                <button onClick={() => void usersQuery.refetch()} className="ml-2 underline">Retry</button>
              </div>
            ) : usersQuery.data?.users.length === 0 ? (
              <EmptyState icon={Search} title="No matches" description="Try a different email or username." />
            ) : (
              <ul className="space-y-1 max-h-80 overflow-y-auto">
                {usersQuery.data?.users.map((u) => (
                  <li key={u.id}>
                    <button
                      onClick={() => setSelected(u)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                        selected?.id === u.id
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                          : 'border-transparent hover:bg-[var(--color-surface-sunken)]'
                      }`}
                    >
                      <span className="block text-sm truncate">{u.name || u.username || 'Unnamed'}</span>
                      <span className="block text-xs text-muted-foreground truncate">{u.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {usersQuery.data && usersQuery.data.pagination.pages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </Button>
                <span className="text-xs text-muted-foreground">
                  {usersQuery.data.pagination.page} / {usersQuery.data.pagination.pages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= usersQuery.data.pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Balance + adjustments */}
        <Card className="glass-card-3d lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-sm uppercase tracking-widest text-muted-foreground">
              <span className="flex items-center gap-2">
                <WalletIcon className="w-4 h-4" />
                {selected ? `Ledger — ${selected.email}` : 'Ledger'}
              </span>
              <button
                onClick={refreshAll}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground"
                title="Reload this account"
              >
                <RefreshCw className={`w-4 h-4 ${walletQuery.isFetching ? 'animate-spin' : ''}`} />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {!selected ? (
              <EmptyState
                icon={Users}
                title="No account selected"
                description="Pick a user on the left to read their wallet and post adjustments."
              />
            ) : walletQuery.isLoading ? (
              <LoadingState />
            ) : walletQuery.isError ? (
              <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-400">
                {(walletQuery.error as Error).message}
                <button onClick={() => void walletQuery.refetch()} className="ml-2 underline">Retry</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Figure label="Available" value={inr(wallet!.balance)} accent />
                  <Figure label="In escrow" value={inr(wallet!.escrow)} />
                  <Figure label="Pending in" value={inr(wallet!.pendingIn)} />
                  <Figure label="Blocked" value={inr(wallet!.blocked)} danger={wallet!.blocked > 0} />
                </div>

                {wallet!.pendingOut > 0 && (
                  <p className="flex items-center gap-2 text-xs text-amber-400">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    {inr(wallet!.pendingOut)} is committed to withdrawal requests awaiting approval.
                  </p>
                )}

                <div className="space-y-3 rounded-xl border border-border p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs text-muted-foreground">Amount (₹)</span>
                      <Input
                        type="number"
                        min={1}
                        max={100000}
                        value={amount}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                        placeholder="500"
                        className="glass border-border mt-1"
                      />
                    </label>
                    <label className="block sm:col-span-1">
                      <span className="text-xs text-muted-foreground">Reason (audited, mandatory)</span>
                      <Input
                        value={reason}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
                        placeholder="Goodwill refund for dropped session"
                        className="glass border-border mt-1"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="primary"
                      className="btn-luxury"
                      disabled={Boolean(validation) || adjust.isPending}
                      onClick={() => beginAdjust('credit')}
                    >
                      <ArrowUpRight className="w-4 h-4" /> Credit
                    </Button>
                    <Button
                      variant="outline"
                      disabled={Boolean(validation) || adjust.isPending}
                      onClick={() => beginAdjust('debit')}
                    >
                      <ArrowDownRight className="w-4 h-4" /> Debit
                    </Button>
                    <span className="text-xs text-muted-foreground ml-auto">{validation ?? 'Ready to post.'}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent movements */}
      <Card className="glass-card-3d">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">
            Recent movements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select an account to read its transaction history.</p>
          ) : ledgerQuery.isLoading ? (
            <LoadingState />
          ) : ledgerQuery.isError ? (
            <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-400">
              {(ledgerQuery.error as Error).message}
              <button onClick={() => void ledgerQuery.refetch()} className="ml-2 underline">Retry</button>
            </div>
          ) : ledgerQuery.data?.items.length === 0 ? (
            <EmptyState icon={WalletIcon} title="No movements yet" description="This account has no transactions." />
          ) : (
            <ul className="divide-y divide-border">
              {ledgerQuery.data?.items.map((tx) => {
                const positive = tx.amount >= 0;
                return (
                  <li key={tx.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        positive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {positive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm truncate">{tx.description || tx.type}</span>
                      <span className="block text-xs text-muted-foreground">
                        {tx.type} · {new Date(tx.createdAt).toLocaleString()}
                        {tx.referenceId ? ` · ${tx.referenceId}` : ''}
                      </span>
                    </span>
                    <span
                      className={`text-sm font-mono tabular-nums ${
                        positive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {positive ? '+' : '−'}{inr(Math.abs(tx.amount))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => { if (!open) setConfirming(null); }}
        title={confirming?.kind === 'credit'
          ? `Credit ${inr(confirming.amount)} to ${selected?.email}?`
          : `Debit ${inr(confirming?.amount ?? 0)} from ${selected?.email}?`}
        description={`Reason: "${confirming?.reason ?? ''}". Both directions are written to the admin audit log with your identity, the target account and the request IP.`}
        confirmLabel={confirming?.kind === 'credit' ? 'Post credit' : 'Post debit'}
        destructive={confirming?.kind === 'debit'}
        loading={adjust.isPending}
        onConfirm={async () => {
          if (!confirming) return;
          await adjust.mutateAsync(confirming);
          setConfirming(null);
        }}
      />
    </div>
  );
}

function Figure({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</p>
      <p
        className={`text-lg font-bold font-mono tabular-nums mt-1 ${
          danger ? 'text-rose-400' : accent ? 'text-[var(--color-primary)]' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function WalletPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-muted-foreground flex items-center gap-2">
          <WalletIcon className="w-5 h-5 text-[var(--color-primary)]" /> Wallet ledger
        </h1>
      </div>
      <ErrorBoundary>
        <LedgerContent />
      </ErrorBoundary>
    </motion.div>
  );
}
