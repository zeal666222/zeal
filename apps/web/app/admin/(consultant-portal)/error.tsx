"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";
import { Button } from "@zeal/ui";

export default function ConsultantPortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[consultant-portal-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[color-mix(in_srgb,var(--color-surface,#111)_92%,transparent)] p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
          <AlertTriangle className="h-8 w-8 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Consultant console error</h2>
        <p className="mt-2 text-sm text-white/60">
          {error.message || "Something went wrong while loading your consultant console."}
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-white/40">Ref: {error.digest}</p>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="primary" onClick={reset}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
          <a href="/admin/consultant/dashboard">
            <Button variant="secondary" className="w-full sm:w-auto">
              <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
