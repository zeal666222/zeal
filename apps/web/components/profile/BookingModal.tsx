"use client";

import { toast } from "@/components/ui/toaster";
import {useState} from "react";
import { ArrowRight, CreditCard, X } from "lucide-react";
import {useAuth} from "@/components/providers/SupabaseAuthProvider";
import {useRouter} from "next/navigation";

interface BookingModalProps {
  healerId: string;
  healerName: string;
  perMinuteRate: number;
  onClose: () => void;
}

export function BookingModal({ healerId, healerName, perMinuteRate, onClose }: BookingModalProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [duration, setDuration] = useState(15);

  const totalAmount = (duration / 60) * perMinuteRate;

  const handleBook = () => {
    if (!user) {
      toast({ title: "Please sign in to book a session.", variant: "destructive" });
      router.push("/login");
      return;
    }
    router.push(`/booking?consultantId=${healerId}&duration=${duration}`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-[var(--color-muted-foreground)]">Book {healerName}</h2>
          <button onClick={onClose} className="p-2 hover:bg-[var(--color-surface-sunken)] rounded-full">
            <X className="w-5 h-5 text-[var(--color-subtle-foreground)]" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-muted-foreground)] mb-1">Duration</label>
            <select
              value={duration}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDuration(Number(e.target.value))}
              className="w-full px-3 py-2 border border-[var(--color-primary-muted)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
            </select>
          </div>

          <div className="bg-[var(--color-surface-sunken)] rounded-xl p-4">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--color-muted-foreground)]">Rate</span>
              <span className="text-[var(--color-muted-foreground)]">₹{perMinuteRate}/min</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-[var(--color-muted-foreground)]">Duration</span>
              <span className="text-[var(--color-muted-foreground)]">{duration} min</span>
            </div>
            <div className="flex justify-between font-bold mt-2 pt-2 border-t border-[var(--color-primary-muted)]">
              <span className="text-[var(--color-muted-foreground)]">Estimated Total</span>
              <span className="text-[var(--color-primary)]">₹{totalAmount.toFixed(2)}</span>
            </div>
            <p className="text-xs text-[var(--color-subtle-foreground)] mt-2">
              Pick your date, time slot, and service on the next step. Payment is secured via Razorpay.
            </p>
          </div>

          <button
            onClick={handleBook}
            className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            Continue to secure booking
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
