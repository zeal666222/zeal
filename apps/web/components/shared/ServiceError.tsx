"use client";

import { motion } from "framer-motion";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ServiceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen-app flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 22 }}
        className="text-center space-y-6 max-w-sm"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
          className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center"
        >
          <AlertTriangle size={28} className="text-rose-400" />
        </motion.div>

        <div>
          <h2 className="text-lg font-black text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mt-2">
            {error.message || "An unexpected error occurred while loading this page."}
          </p>
        </div>

        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-3 bg-[var(--color-primary)] text-white rounded-2xl font-bold text-sm hover:shadow-lg hover:shadow-[var(--color-primary)]/20 transition-all"
        >
          <RotateCcw size={14} />
          Try again
        </button>

        {error.digest && (
          <p className="text-[10px] text-muted-foreground/50 font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </motion.div>
    </div>
  );
}
