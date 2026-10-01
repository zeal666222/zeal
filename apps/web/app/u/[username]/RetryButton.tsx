"use client";
// Retry button for soft load failures — re-runs the server render without a full reload.

import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RetryButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                 text-white text-sm font-black
                 hover:scale-[1.02] active:scale-[0.98] transition-transform"
    >
      <RefreshCw size={14} />
      Try again
    </button>
  );
}
