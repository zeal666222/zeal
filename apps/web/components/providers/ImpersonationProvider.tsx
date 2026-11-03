"use client";

import { useEffect } from "react";
import { patchGlobalFetch } from "@/lib/auth/impersonation-fetch";

/**
 * Patches the global fetch to inject impersonation headers on all /api/ calls.
 * Mount this once in your root layout or providers.
 */
export function ImpersonationProvider() {
  useEffect(() => {
    patchGlobalFetch();
  }, []);
  
  return null;
}
