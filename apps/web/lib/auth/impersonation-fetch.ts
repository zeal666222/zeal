// ═══════════════════════════════════════════════════════════════════════════════
// Impersonation-aware fetch wrapper
// ─────────────────────────────────────────────────────────────────────────────
// Wraps the native fetch() to automatically inject impersonation headers when
// an admin is impersonating a user. Reads from sessionStorage.
// ═══════════════════════════════════════════════════════════════════════════════

interface ImpersonationState {
  targetUserId: string;
  targetName: string;
  targetType: "user" | "consultant" | "ai";
  expiresAt: string;
}

function getImpersonationHeader(): { key: string; value: string } | null {
  if (typeof window === "undefined") return null;
  
  try {
    const raw = localStorage.getItem("zeal-impersonate");
    if (!raw) return null;
    
    const parsed = JSON.parse(raw) as ImpersonationState;
    
    // Check expiry
    if (new Date(parsed.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem("zeal-impersonate");
      return null;
    }
    
    // Return appropriate header based on target type
    if (parsed.targetType === "ai") {
      return { key: "X-Act-As-AI-Id", value: parsed.targetUserId };
    }
    return { key: "X-Act-As-User-Id", value: parsed.targetUserId };
  } catch {
    return null;
  }
}

/**
 * Fetch wrapper that automatically injects impersonation headers.
 * Use this instead of native fetch() for all API calls.
 */
export function impersonatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const impersonationHeader = getImpersonationHeader();
  
  if (impersonationHeader) {
    headers.set(impersonationHeader.key, impersonationHeader.value);
  }
  
  return fetch(input, {
    ...init,
    headers,
  });
}

/**
 * Patch the global fetch to include impersonation headers.
 * Call this once in your app's entry point (e.g., layout.tsx or providers).
 */
export function patchGlobalFetch(): void {
  if (typeof window === "undefined") return;
  
  const originalFetch = window.fetch;
  
  window.fetch = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    // Only patch for /api/ calls to avoid affecting external requests
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    
    if (url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`)) {
      return impersonatedFetch(input, init);
    }
    
    return originalFetch(input, init);
  };
}
