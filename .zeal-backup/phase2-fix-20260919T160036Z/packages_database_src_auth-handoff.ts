import "server-only";
import {createAdminClient} from "./server";

export async function generateAdminHandoff(email: string): Promise<string | null> {
  const adminUrl = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "").replace(/\/$/, "");
  if (!adminUrl) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink", email, options: { redirectTo: `${adminUrl}/auth/handoff` },
    });
    if (error || !data?.properties?.hashed_token) return null;
    const url = new URL(`${adminUrl}/auth/handoff`);
    url.searchParams.set("token_hash", data.properties.hashed_token);
    url.searchParams.set("type", "magiclink");
    return url.toString();
  } catch { return null; }
}
