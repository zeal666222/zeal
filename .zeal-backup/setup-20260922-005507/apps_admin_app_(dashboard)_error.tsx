"use client";
import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@zeal/ui";

export default function AdminDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error("[admin-error]", error); }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-rose-400" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Console error</h2>
      <p className="text-sm text-slate-400 mb-4 max-w-md">
        {error.message || "An unexpected error occurred."}
      </p>
      {error.digest && (
        <p className="text-xs text-slate-600 font-mono mb-4">ID: {error.digest}</p>
      )}
      <Button variant="primary" onClick={reset}>
        <RefreshCw className="w-4 h-4 mr-2" /> Try again
      </Button>
    </div>
  );
}
