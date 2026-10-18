import type { Env } from "./env";

function headers(env: Env): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    Prefer: "return=representation",
  };
}

export async function rpc<T = unknown>(
  env: Env,
  fn: string,
  args: Record<string, unknown>,
): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: headers(env),
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { data: null, error: { message: `RPC ${fn} failed: ${res.status} ${text.slice(0, 200)}` } };
    }
    const data = await res.json() as T;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

export async function insertRow(
  env: Env,
  table: string,
  row: Record<string, unknown>,
): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...headers(env), Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { data: null, error: { message: `Insert ${table} failed: ${res.status} ${text.slice(0, 200)}` } };
    }
    const data = await res.json();
    const arr = Array.isArray(data) ? data[0] : data;
    return { data: arr ?? null, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

export async function queryRows<T = Record<string, unknown>>(
  env: Env,
  table: string,
  params: Record<string, string>,
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const qs = new URLSearchParams(params).toString();
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${qs}`, {
      headers: headers(env),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { data: null, error: { message: `Query ${table} failed: ${res.status} ${text.slice(0, 200)}` } };
    }
    const data = await res.json() as T[];
    return { data, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}
