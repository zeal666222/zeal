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

let _originalFetch: typeof window.fetch | null = null;

export function impersonatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const impersonationHeader = getImpersonationHeader();

  if (impersonationHeader) {
    headers.set(impersonationHeader.key, impersonationHeader.value);
  }

  const base = _originalFetch ?? window.fetch;
  return base(input, { ...init, headers });
}

export function patchGlobalFetch(): void {
  if (typeof window === "undefined") return;
  if (_originalFetch) return;

  _originalFetch = window.fetch;

  window.fetch = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

    if (url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`)) {
      return impersonatedFetch(input, init);
    }

    return _originalFetch!(input, init);
  };
}
