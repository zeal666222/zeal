"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Admin Bookings — table with status pills + payment column
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Badge, Card, CardContent, Button } from "@zeal/ui";
import { toast } from "@/components/ui/toaster";
import {
  Calendar, Check, ChevronLeft, ChevronRight, Loader2, RefreshCw, X,
} from "lucide-react";

interface BookingRow {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  amount: number;
  status: string;
  serviceType?: string | null;
  razorpayPaymentId?: string | null;
  paymentStatus?: string | null;
  user?: { name?: string | null; email?: string | null } | null;
  consultant?: { user?: { name?: string | null } | null } | null;
}

interface Response {
  items?: BookingRow[];
  total?: number;
}

const STATUS_BADGE: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  CONFIRMED: "success",
  PENDING: "warning",
  PENDING_PAYMENT: "warning",
  IN_PROGRESS: "success",
  CANCELLED: "destructive",
  COMPLETED: "secondary",
  MISSED: "destructive",
};

export default function AdminBookingsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 15;

  const { data, isLoading, refetch } = useQuery<Response>({
    queryKey: ["admin", "bookings", filter, page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/bookings?status=${filter}&page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 20_000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Booking updated", variant: "success" });
      void qc.invalidateQueries({ queryKey: ["admin", "bookings"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const bookings = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-foreground">Bookings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total.toLocaleString()} booking{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl bg-surface border border-border text-sm text-foreground outline-none focus:border-[var(--color-primary)]"
          >
            <option value="all">All</option>
            <option value="PENDING_PAYMENT">Awaiting payment</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <button
            onClick={() => void refetch()}
            className="p-2 rounded-xl bg-surface border border-border hover:border-[var(--color-primary)]/40 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <Card className="border-border bg-surface">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl m-4">
              <Calendar size={32} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No bookings match this filter</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-raised">
                  <tr>
                    {["User", "Consultant", "Service", "Date", "Amount", "Payment", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-surface-raised/60 transition-colors">
                      <td className="p-3 text-sm text-foreground truncate max-w-[140px]">
                        {b.user?.name ?? b.user?.email ?? "—"}
                      </td>
                      <td className="p-3 text-sm text-foreground truncate max-w-[140px]">
                        {b.consultant?.user?.name ?? "—"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground capitalize">
                        {b.serviceType ?? "chat"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(b.scheduledAt).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3 text-sm font-mono font-bold text-[var(--color-primary)] whitespace-nowrap">
                        ₹{b.amount.toFixed(2)}
                      </td>
                      <td className="p-3 text-[10px] font-mono text-muted-foreground truncate max-w-[120px]">
                        {b.razorpayPaymentId ?? "—"}
                      </td>
                      <td className="p-3">
                        <Badge variant={STATUS_BADGE[b.status] ?? "secondary"}>
                          {b.status.replace(/_/g, " ").toLowerCase()}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {(b.status === "PENDING" || b.status === "PENDING_PAYMENT") && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => updateStatus.mutate({ id: b.id, status: "CONFIRMED" })}
                              disabled={updateStatus.isPending}
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 disabled:opacity-50"
                              aria-label="Confirm"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              onClick={() => updateStatus.mutate({ id: b.id, status: "CANCELLED" })}
                              disabled={updateStatus.isPending}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 disabled:opacity-50"
                              aria-label="Cancel"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </motion.div>
  );
}
