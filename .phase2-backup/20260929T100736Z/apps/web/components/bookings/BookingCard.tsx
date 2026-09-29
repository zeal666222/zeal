"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// BookingCard — status timeline + contextual actions
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Calendar, Check, CheckCircle2, Clock, Loader2, MessageCircle,
  Star, Video, X,
} from "lucide-react";
import { formatCurrency } from "@zeal/utils";
import { ConfirmDialog } from "@zeal/ui";
import { toast } from "@/components/ui/toaster";

export interface BookingSummary {
  id: string;
  status: string;
  scheduledAt: string;
  durationMinutes: number;
  amount: number;
  meetingLink?: string | null;
  rating?: number | null;
  serviceType?: string | null;
  consultant: {
    id: string;
    category: string;
    user: { name?: string | null; username: string; avatar?: string | null };
  };
  user?: { name?: string | null; username: string } | null;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  CONFIRMED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  IN_PROGRESS: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  COMPLETED: "bg-surface-raised text-muted-foreground border-border",
  CANCELLED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  MISSED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In session",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  MISSED: "Missed",
};

interface Props {
  booking: BookingSummary;
  role?: "user" | "consultant";
  index?: number;
  onRefetch?: () => void;
}

export function BookingCard({ booking, role = "user", index = 0, onRefetch }: Props) {
  const other = role === "user" ? booking.consultant.user : booking.user;
  const otherName = other?.name ?? other?.username ?? "—";
  const scheduled = new Date(booking.scheduledAt);
  const isUpcoming = scheduled.getTime() > Date.now();
  const canJoin =
    booking.status === "CONFIRMED" || booking.status === "IN_PROGRESS";
  const canCancel =
    (booking.status === "PENDING_PAYMENT" ||
      booking.status === "PENDING" ||
      booking.status === "CONFIRMED") && isUpcoming;
  const canRate = booking.status === "COMPLETED" && !booking.rating;
  const needsPayment = booking.status === "PENDING_PAYMENT";

  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");

  const cancel = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "User cancelled" }),
      });
      if (!res.ok) throw new Error("Cancel failed");
      const data = (await res.json()) as { refundAmount?: number };
      toast({
        title: data.refundAmount && data.refundAmount > 0
          ? `Cancelled. ₹${data.refundAmount.toFixed(2)} refunded.`
          : "Booking cancelled",
        variant: "success",
      });
      onRefetch?.();
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Failed to cancel",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      setConfirmCancel(false);
    }
  }, [booking.id, onRefetch]);

  const submitRating = useCallback(async () => {
    if (rating < 1) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, review: review.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Rating failed");
      toast({ title: "Thanks for rating", variant: "success" });
      setShowRating(false);
      onRefetch?.();
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Failed to rate",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }, [booking.id, rating, review, onRefetch]);

  const timeline = buildTimeline(booking.status, scheduled);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.2) }}
      className="glass-card-3d p-4 md:p-5"
    >
      <div className="flex items-start gap-3 md:gap-4">
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-primary-hover)]/10 flex items-center justify-center flex-shrink-0 text-lg font-black text-[var(--color-primary)]">
          {otherName.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <p className="font-bold text-foreground truncate">{otherName}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {booking.consultant.category.toLowerCase()}
              </p>
            </div>
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border whitespace-nowrap ${
              STATUS_STYLE[booking.status] ?? STATUS_STYLE.COMPLETED
            }`}>
              {STATUS_LABEL[booking.status] ?? booking.status}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {scheduled.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {scheduled.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="flex items-center gap-1">
              <Video className="w-3 h-3" />
              {booking.durationMinutes} min
            </span>
            <span className="font-black text-[var(--color-primary)] font-mono">
              {formatCurrency(booking.amount)}
            </span>
            {booking.rating != null && (
              <span className="flex items-center gap-1 text-amber-400">
                <Star className="w-3 h-3 fill-amber-400" /> {booking.rating}
              </span>
            )}
          </div>

          {/* Timeline */}
          <div className="mt-3 flex items-center gap-1.5">
            {timeline.map((t, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${t.done ? "bg-[var(--color-primary)]" : "bg-surface-raised border border-border"}`} />
                {i < timeline.length - 1 && (
                  <div className={`w-6 h-px ${t.done ? "bg-[var(--color-primary)]" : "bg-border"}`} />
                )}
              </div>
            ))}
            <span className="ml-2 text-[10px] uppercase tracking-widest font-black text-muted-foreground">
              {timeline.filter((t) => t.done).length}/{timeline.length}
            </span>
          </div>

          {/* Rating panel */}
          {showRating && (
            <div className="mt-3 p-3 rounded-xl bg-surface-raised space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black">Rate your session</span>
                <button onClick={() => setShowRating(false)} className="p-1 rounded hover:bg-surface-overlay">
                  <X size={12} />
                </button>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    className="p-1 transition-transform hover:scale-110"
                    aria-label={`${n} stars`}
                  >
                    <Star className={`w-6 h-6 ${n <= rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40"}`} />
                  </button>
                ))}
              </div>
              <textarea
                value={review}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReview(e.target.value)}
                placeholder="Optional review…"
                rows={2}
                maxLength={500}
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-xs resize-none"
              />
              <button
                onClick={() => void submitRating()}
                disabled={rating < 1 || busy}
                className="w-full py-2 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                           text-white text-xs font-black disabled:opacity-50
                           flex items-center justify-center gap-1.5"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Submit
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-3">
            {needsPayment && (
              <Link
                href={`/booking?consultantId=${booking.consultant.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                           bg-gradient-to-r from-amber-500 to-amber-600
                           text-white text-xs font-black
                           shadow-md shadow-amber-500/20
                           transition-all active:scale-95"
              >
                Complete payment
              </Link>
            )}
            {canJoin && (
              <Link
                href={`/call/${booking.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                           bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                           text-white text-xs font-black
                           transition-all active:scale-95"
              >
                <Video className="w-3 h-3" /> Join
              </Link>
            )}
            <Link
              href={`/chat?consultantId=${booking.consultant.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                         bg-surface-raised text-foreground text-xs font-bold
                         transition-colors"
            >
              <MessageCircle className="w-3 h-3" /> Chat
            </Link>
            {canCancel && (
              <button
                onClick={() => setConfirmCancel(true)}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg
                           bg-rose-500/10 text-rose-400 text-xs font-bold
                           disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            )}
            {canRate && !showRating && (
              <button
                onClick={() => setShowRating(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg
                           bg-amber-500/10 text-amber-400 text-xs font-bold
                           transition-colors"
              >
                <Star className="w-3 h-3" /> Rate
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this booking?"
        description="Refunds depend on how close you are to the session."
        confirmLabel="Cancel booking"
        cancelLabel="Keep booking"
        destructive
        loading={busy}
        onConfirm={cancel}
      />
    </motion.div>
  );
}

function buildTimeline(status: string, scheduled: Date): Array<{ done: boolean }> {
  const created = true;
  const paid =
    status !== "PENDING_PAYMENT" && status !== "CANCELLED";
  const confirmed =
    status === "CONFIRMED" || status === "IN_PROGRESS" || status === "COMPLETED";
  const inSession =
    status === "IN_PROGRESS" || status === "COMPLETED";
  const completed =
    status === "COMPLETED" || scheduled.getTime() < Date.now();
  return [
    { done: created },
    { done: paid },
    { done: confirmed },
    { done: inSession },
    { done: completed },
  ].slice(0, status === "CANCELLED" ? 3 : 5);
}
