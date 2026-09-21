"use client";

import {useState} from "react";
import {motion} from "framer-motion";
import Link from "next/link";
import {Calendar, Clock, Video, Phone, MessageCircle, Star, Loader2, X, Check} from "lucide-react";
import {formatCurrency} from "@zeal/utils";

export interface BookingSummary {
  id: string;
  status: string;
  scheduledAt: string;
  durationMinutes: number;
  amount: number;
  meetingLink?: string | null;
  rating?: number | null;
  consultant: {
    id: string;
    category: string;
    user: { name?: string | null; username: string; avatar?: string | null };
  };
  user?: { name?: string | null; username: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING:     "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  CONFIRMED:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED:   "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  CANCELLED:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  MISSED:      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

interface BookingCardProps {
  booking: BookingSummary;
  role?: "user" | "consultant";
  index?: number;
  onRefetch?: () => void;
}

export function BookingCard({ booking, role = "user", index = 0, onRefetch }: BookingCardProps) {
  const consultant = booking.consultant;
  const otherParty = role === "user" ? consultant.user : booking.user;
  const otherName = otherParty?.name || otherParty?.username || "—";

  const scheduledDate = new Date(booking.scheduledAt);
  const isUpcoming = scheduledDate.getTime() > Date.now();
  const canJoin = booking.status === "CONFIRMED" || booking.status === "IN_PROGRESS";
  const canCancel = (booking.status === "PENDING" || booking.status === "CONFIRMED") && isUpcoming;
  const canReschedule = canCancel && role === "user";
  const canRate = booking.status === "COMPLETED" && role === "user" && !booking.rating;

  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [busy, setBusy] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState("");

  const cancel = async () => {
    if (!confirm("Cancel this booking? Refunds may apply.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error("Cancel failed");
      onRefetch?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setBusy(false);
    }
  };

  const submitRating = async () => {
    if (rating < 1) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, review: review.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Rating failed");
      setShowRating(false);
      onRefetch?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to rate");
    } finally {
      setBusy(false);
    }
  };

  const submitReschedule = async () => {
    if (!newDate) return;
    const iso = new Date(newDate).toISOString();
    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: iso }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } }).error?.message || "Reschedule failed");
      }
      setShowReschedule(false);
      onRefetch?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reschedule");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), type: "spring", stiffness: 180, damping: 22 }}
      className="glass-card-3d p-4 md:p-5"
    >
      <div className="flex items-start gap-3 md:gap-4">
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-[#9D7DC5]/20 to-[#533AFD]/10 flex items-center justify-center flex-shrink-0 text-lg font-semibold text-[#9D7DC5]">
          {otherName.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <p className="font-semibold text-[#5E4B8B] dark:text-white truncate">{otherName}</p>
              <p className="text-xs text-[#B8A1D9] dark:text-gray-400 capitalize">
                {consultant.category.toLowerCase()}
              </p>
            </div>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[booking.status] || STATUS_STYLES.COMPLETED}`}>
              {booking.status}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#B8A1D9] dark:text-gray-400 mt-2">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {scheduledDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {scheduledDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="flex items-center gap-1">
              <Video className="w-3 h-3" />
              {booking.durationMinutes} min
            </span>
            <span className="font-medium text-[#9D7DC5]">{formatCurrency(booking.amount)}</span>
            {booking.rating && (
              <span className="flex items-center gap-1 text-amber-500">
                <Star className="w-3 h-3 fill-amber-500" /> {booking.rating}
              </span>
            )}
          </div>

          {/* Rating panel */}
          {showRating && (
            <div className="mt-3 p-3 rounded-xl bg-[#F4E8F7]/50 dark:bg-gray-800/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#5E4B8B] dark:text-white">Rate your session</span>
                <button onClick={() => setShowRating(false)} className="p-1 rounded hover:bg-white/10">
                  <X size={12} />
                </button>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star className={`w-6 h-6 ${n <= rating ? "fill-amber-500 text-amber-500" : "text-gray-300"}`} />
                  </button>
                ))}
              </div>
              <textarea
                value={review}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReview(e.target.value)}
                placeholder="Optional review..."
                rows={2}
                maxLength={500}
                className="w-full px-3 py-2 rounded-lg border border-[#E1C5E7] dark:border-gray-700 bg-white dark:bg-gray-900 text-xs resize-none"
              />
              <button
                onClick={submitRating}
                disabled={rating < 1 || busy}
                className="w-full py-2 rounded-lg bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Submit rating
              </button>
            </div>
          )}

          {/* Reschedule panel */}
          {showReschedule && (
            <div className="mt-3 p-3 rounded-xl bg-[#F4E8F7]/50 dark:bg-gray-800/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#5E4B8B] dark:text-white">New date & time</span>
                <button onClick={() => setShowReschedule(false)} className="p-1 rounded hover:bg-white/10">
                  <X size={12} />
                </button>
              </div>
              <input
                type="datetime-local"
                value={newDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#E1C5E7] dark:border-gray-700 bg-white dark:bg-gray-900 text-xs"
              />
              <button
                onClick={submitReschedule}
                disabled={!newDate || busy}
                className="w-full py-2 rounded-lg bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Confirm reschedule
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-3">
            {canJoin && (
              <Link
                href={`/call/${booking.id}`}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white text-xs font-medium"
              >
                <Phone className="w-3 h-3" /> Join
              </Link>
            )}
            <Link
              href={`/chat/${consultant.id}`}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F4E8F7] dark:bg-gray-800 text-[#5E4B8B] dark:text-white text-xs font-medium"
            >
              <MessageCircle className="w-3 h-3" /> Chat
            </Link>
            {canReschedule && !showReschedule && (
              <button
                onClick={() => setShowReschedule(true)}
                className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium"
              >
                Reschedule
              </button>
            )}
            {canCancel && (
              <button
                onClick={cancel}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            {canRate && !showRating && (
              <button
                onClick={() => setShowRating(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs font-medium"
              >
                <Star className="w-3 h-3" /> Rate
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
