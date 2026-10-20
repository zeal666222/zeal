// Server-side client for the Cloudflare admin-realtime bus (zeal-admin-realtime).
//
// Fire-and-forget: business flows must NEVER fail because the live dashboard
// feed is unavailable. If ADMIN_BUS_URL or the service-role key are missing this
// is a complete no-op — Supabase Realtime keeps working independently.
//
// Auth model: we present the Supabase service-role key as the bearer token; the
// worker validates it against Supabase's admin endpoint before accepting the
// event. No second shared secret is provisioned on either side.

export interface BusEventInput {
  kind: string;              // e.g. "booking_confirmed", "withdrawal_requested"
  label: string;             // human line for the live feed
  actor?: string | null;     // id or name of who did it (optional)
  amount?: number | null;    // ₹ value where money moved (optional)
  meta?: Record<string, unknown> | null;
}

let cachedBase: string | null = null;
let warned = false;

function busUrl(): string | null {
  const raw = process.env.ADMIN_BUS_URL;
  if (!raw) return null;
  cachedBase = raw.replace(/\/+$/, "");
  return cachedBase;
}

/** Best-effort push of a live event. Resolves void; never throws. */
export async function sendAdminBus(event: BusEventInput): Promise<void> {
  const base = busUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    if (!warned && process.env.NODE_ENV !== "production") {
      warned = true;
      console.warn("[admin-bus] ADMIN_BUS_URL / SUPABASE_SERVICE_ROLE_KEY unset — live bus ingest disabled");
    }
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    await fetch(`${base}/ingest`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(event),
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch {
    // Swallow — the live feed is observability, not a business dependency.
  }
}
