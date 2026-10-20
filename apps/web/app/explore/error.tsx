"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@zeal/ui";

export default function ExploreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[explore-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10">
        <AlertCircle className="h-8 w-8 text-rose-400" />
      </div>
      <h2 className="mb-2 text-xl font-bold text-foreground">Could not load consultants</h2>
      <p className="mb-4 max-w-md text-sm text-muted-foreground">
        {error.message || "We had trouble loading the consultant directory. Please try again."}
      </p>
      {error.digest && (
        <p className="mb-4 font-mono text-xs text-muted-foreground">ID: {error.digest}</p>
      )}
      <Button variant="primary" onClick={reset}>
        <RefreshCw className="mr-2 h-4 w-4" /> Try again
      </Button>
    </div>
  );
}
