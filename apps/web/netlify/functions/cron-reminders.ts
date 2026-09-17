// Netlify Scheduled Function — replaces Vercel cron
// Runs every 5 minutes, calls the internal reminders API
import type { Config, Context } from "@netlify/functions";

export default async (_req: Request, _context: Context) => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || "";
  const secret = process.env.CRON_SECRET || "";

  if (!baseUrl) {
    console.error("[cron-reminders] NEXT_PUBLIC_APP_URL missing");
    return new Response(JSON.stringify({ ok: false, error: "no base url" }), {
      status: 500,
    });
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/reminders`, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const data = await res.json().catch(() => ({}));
    console.log("[cron-reminders]", res.status, data);
    return new Response(JSON.stringify({ ok: res.ok, status: res.status }), {
      status: 200,
    });
  } catch (err) {
    console.error("[cron-reminders] failed:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
    });
  }
};

export const config: Config = {
  schedule: "*/5 * * * *",
};
