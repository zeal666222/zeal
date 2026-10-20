// ═══════════════════════════════════════════════════════════════════════════════
// Hardcore Infrastructure Layer
// ═══════════════════════════════════════════════════════════════════════════════
// safeQuery    — wraps Supabase queries, throws AppError on DB failure
// safeRpc      — wraps Supabase RPCs, throws AppError on failure
// withAuth     — extracts + validates user from cookies, throws if missing
// withRateLimit — per-route rate limiting guard
// safePublish  — fire-and-forget realtime with error logging (never throws)
// ═══════════════════════════════════════════════════════════════════════════════

import { AppError, ErrorCode, AuthenticationError } from "../errors";

// ─── safeQuery ──────────────────────────────────────────────────────────────
// Wraps a Supabase query result { data, error } and throws AppError if error.
// Usage: const users = await safeQuery(supabase.from("User").select("*"));
export async function safeQuery<T>(
  query: PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>,
  context?: string,
): Promise<T> {
  const { data, error } = await query;
  if (error) {
    const tag = context ? `[${context}]` : "[DB]";
    console.error(`${tag} Query failed:`, error.message, error.code ?? "");
    throw new AppError(
      error.message,
      500,
      ErrorCode.INTERNAL_DATABASE,
      { pgCode: error.code, context },
    );
  }
  return data as T;
}

// ─── safeQueryOne ───────────────────────────────────────────────────────────
// Like safeQuery but for .maybeSingle() / .single() — returns null if no row.
export async function safeQueryOne<T>(
  query: PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>,
  context?: string,
): Promise<T | null> {
  return safeQuery<T>(query, context);
}

// ─── safeRpc ────────────────────────────────────────────────────────────────
// Wraps supabase.rpc() calls with error handling.
export async function safeRpc<T>(
  rpc: PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>,
  context?: string,
): Promise<T> {
  const { data, error } = await rpc;
  if (error) {
    const tag = context ? `[RPC:${context}]` : "[RPC]";
    console.error(`${tag} RPC failed:`, error.message, error.code ?? "");
    throw new AppError(
      error.message,
      500,
      ErrorCode.INTERNAL_DATABASE,
      { pgCode: error.code, context },
    );
  }
  return data as T;
}

// ─── Missing-function detection ─────────────────────────────────────────────
// PostgREST resolves .rpc() by NAMED arguments, so a call whose parameter set
// does not match a live function is not a runtime error — it is a 404 from the
// gateway: PGRST202 "could not find the function". That is the signature of a
// migration the operator has not applied, and it needs a different response
// from a real database failure: try the shape the live schema actually offers.
export function isMissingFunctionError(
  error: { message?: string; code?: string } | null,
): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /could not find the function|function .* does not exist/i.test(error.message ?? "")
  );
}

export interface RpcResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

// ─── rpcWithLiveSignatures ────────────────────────────────────────────────────
// Runs the listed calls in order and stops at the first one the gateway could
// actually resolve. The first attempt is always the intended (post-migration)
// shape, so applying the migration silently promotes the flow to it; a later
// attempt is the shape live prod answers today. A business error
// ({success:false}) is a real answer and is returned, not retried — retrying
// against a looser signature would run different logic and report it as one.
// `via` is the attempt that served the call, so the caller can disclose what it
// lost (a narrower function cannot store a UPI id, for instance).
export async function rpcWithLiveSignatures<T>(
  fn: string,
  attempts: Array<() => PromiseLike<RpcResult<T>>>,
): Promise<RpcResult<T> & { via: number }> {
  let last: RpcResult<T> & { via: number } = { data: null, error: null, via: -1 };
  for (const [i, call] of attempts.entries()) {
    const { data, error } = await call();
    last = { data, error, via: i };
    if (!isMissingFunctionError(error)) {
      if (i > 0) console.warn(`[RPC:${fn}] live signature #${i + 1} served this call — its migration is not applied yet`);
      return last;
    }
  }
  return last;
}

// ─── withAuth ───────────────────────────────────────────────────────────────
// Extracts authenticated user from Supabase cookies. Throws AuthenticationError
// if not logged in. Returns { user, supabase } for use in route handlers.
export async function withAuth() {
  const { createServerClientFromCookies } = await import("@zeal/database/server");
  const supabase = await createServerClientFromCookies();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new AuthenticationError("Please sign in to continue.");
  }
  return { user, supabase };
}

// ─── withAdminAuth ──────────────────────────────────────────────────────────
// Verifies the user has admin/consultant role. Throws if not authorized.
export async function withAdminAuth() {
  const { user, supabase } = await withAuth();
  const { data: profile } = await supabase
    .from("User")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new AppError("Admin access required", 403, ErrorCode.AUTH_FORBIDDEN);
  }
  return { user, supabase, role };
}

// ─── safePublish ────────────────────────────────────────────────────────────
// Fire-and-forget realtime broadcast with error logging. Never throws.
export function safePublish(
  channel: string,
  event: string,
  payload: unknown,
): void {
  import("@zeal/realtime")
    .then(({ publish }) => publish(channel, event, payload))
    .catch((err) => {
      console.warn(`[Realtime] Publish failed on ${channel}:`, err instanceof Error ? err.message : err);
    });
}

// ─── Retry helper ───────────────────────────────────────────────────────────
// Retries a function with exponential backoff. For transient DB/network errors.
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelay?: number; context?: string } = {},
): Promise<T> {
  const { maxRetries = 2, baseDelay = 100, context = "operation" } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[${context}] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// ─── Circuit Breaker ────────────────────────────────────────────────────────
// Prevents cascading failures when a dependency is down.
export class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: "closed" | "open" | "half-open" = "closed";

  constructor(
    private readonly threshold: number = 5,
    private readonly resetTimeout: number = 30_000,
    private readonly name: string = "circuit",
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = "half-open";
      } else {
        throw new AppError(
          `${this.name} is temporarily unavailable`,
          503,
          ErrorCode.INTERNAL_SERVER,
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = "open";
      console.error(`[Circuit:${this.name}] OPEN after ${this.failures} failures`);
    }
  }

  getState() {
    return { state: this.state, failures: this.failures, name: this.name };
  }
}

// ─── Global circuit breakers for critical dependencies ──────────────────────
export const dbCircuit = new CircuitBreaker(10, 30_000, "database");
export const aiCircuit = new CircuitBreaker(5, 60_000, "ai-provider");
export const storageCircuit = new CircuitBreaker(5, 30_000, "storage");
export const realtimeCircuit = new CircuitBreaker(10, 15_000, "realtime");
