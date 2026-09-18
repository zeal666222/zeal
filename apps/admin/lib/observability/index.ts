// apps/admin/lib/observability/index.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Sentry-compatible facade. When @sentry/nextjs lands, swap the sink — the
// public API (captureError, captureMessage, setUser, addBreadcrumb) stays.
// ═══════════════════════════════════════════════════════════════════════════════

interface ErrorContext {
  [key: string]: unknown;
}

interface ObsUser {
  id: string;
  email?: string | null;
  role?: string;
}

type BreadcrumbLevel = "debug" | "info" | "warning" | "error";

interface Breadcrumb {
  category: string;
  message: string;
  level?: BreadcrumbLevel;
  data?: Record<string, unknown>;
  timestamp?: number;
}

let currentUser: ObsUser | null = null;
const breadcrumbs: Breadcrumb[] = [];
const MAX_BREADCRUMBS = 50;

export function setUser(user: ObsUser | null): void {
  currentUser = user;
}

export function addBreadcrumb(b: Breadcrumb): void {
  breadcrumbs.push({ ...b, timestamp: b.timestamp ?? Date.now() });
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
}

export function captureError(error: unknown, context?: ErrorContext): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  // Server-side: emit structured log
  console.error("[observability] captureError", {
    message,
    stack,
    context,
    userId: currentUser?.id,
    breadcrumbs: breadcrumbs.slice(-10),
    timestamp: new Date().toISOString(),
  });

  // Client-side: forward to server sink (fire and forget)
  if (typeof window !== "undefined") {
    try {
      void fetch("/api/error-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          stack,
          context,
          userId: currentUser?.id,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
        keepalive: true,
      }).catch(() => {});
    } catch { /* ignore */ }
  }
}

export function captureMessage(message: string, context?: ErrorContext): void {
  console.info("[observability] captureMessage", {
    message,
    context,
    userId: currentUser?.id,
    timestamp: new Date().toISOString(),
  });
}

export function getBreadcrumbs(): Breadcrumb[] {
  return [...breadcrumbs];
}

export function clearBreadcrumbs(): void {
  breadcrumbs.length = 0;
}
