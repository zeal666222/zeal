export interface Env {
  DB: D1Database;
  ADMIN_BUS: DurableObjectNamespace;
  ENVIRONMENT: string;

  // Supabase project URL (public) — used to validate operator tokens via the
  // userinfo endpoint and to validate the app's service-role key on /ingest.
  // No signing secret or service key is ever stored on this worker.
  SUPABASE_URL: string;
  // Public anon key — required by the Supabase gateway for the userinfo route.
  SUPABASE_ANON_KEY: string;

  // HMAC key that mints the short-lived WS upgrade ticket (secret, worker-only).
  WS_TICKET_SECRET: string;
}

export interface Principal {
  sub: string;
  role: string;
  exp: number;
}

export const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "SUPPORT", "VIEWER"]);
