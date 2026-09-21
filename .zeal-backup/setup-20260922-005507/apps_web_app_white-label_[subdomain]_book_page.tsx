// ═══════════════════════════════════════════════════════════════════════════════
// White-Label Book — direct Supabase query + auth gate
// ═══════════════════════════════════════════════════════════════════════════════
import {notFound} from "next/navigation";
import {createAdminClient} from "@zeal/database/server";
import Link from "next/link";

interface Props {
  params: Promise<{subdomain: string}>;
}

interface ConsultantRow {
  subdomainActive: boolean | null;
  user:
    | { name: string | null; username: string | null }
    | { name: string | null; username: string | null }[]
    | null;
}

export default async function WhiteLabelBookPage({params}: Props) {
  const {subdomain} = await params;
  const admin = createAdminClient();

  const {data, error} = await admin
    .from("Consultant")
    .select(`
      "subdomainActive",
      user:User!Consultant_userId_fkey(name, username)
    `)
    .eq("subdomain", subdomain)
    .eq("subdomainActive", true)
    .maybeSingle();

  if (error || !data) notFound();

  const row = data as unknown as ConsultantRow;
  const user = Array.isArray(row.user) ? row.user[0] : row.user;
  if (!user) notFound();

  const name = user.name || user.username || "the consultant";
  const loginHref =
    "/auth/login?redirect=" +
    encodeURIComponent(`/white-label/${subdomain}/book`);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-light text-[#5E4B8B] mb-2">
        Book a session with {name}
      </h1>
      <p className="text-[#B8A1D9] mb-8">
        Choose a service, pick a time, and pay securely.
      </p>

      <div className="p-8 rounded-2xl border border-[#E1C5E7] bg-white text-center">
        <p className="text-[#5E4B8B] mb-4">
          Booking is available when signed in. Please log in to continue.
        </p>
        <Link
          href={loginHref}
          className="inline-block px-6 py-3 rounded-xl text-white font-medium"
          style={{
            background:
              "linear-gradient(135deg, var(--wl-primary), var(--wl-accent))",
          }}
        >
          Sign in to Book
        </Link>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
