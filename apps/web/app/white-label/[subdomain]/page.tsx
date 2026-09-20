// ═══════════════════════════════════════════════════════════════════════════════
// White-Label Home — direct Supabase query
// ═══════════════════════════════════════════════════════════════════════════════
import {notFound} from "next/navigation";
import {createAdminClient} from "@zeal/database/server";
import Link from "next/link";

interface Props {
  params: Promise<{subdomain: string}>;
}

interface ConsultantRow {
  bio: string | null;
  chatRate: number | null;
  audioRate: number | null;
  videoRate: number | null;
  user:
    | { name: string | null; username: string | null }
    | { name: string | null; username: string | null }[]
    | null;
}

export default async function WhiteLabelHomePage({params}: Props) {
  const {subdomain} = await params;
  const admin = createAdminClient();

  const {data, error} = await admin
    .from("Consultant")
    .select(`
      bio, "chatRate", "audioRate", "videoRate", "subdomainActive",
      user:User!Consultant_userId_fkey(name, username)
    `)
    .eq("subdomain", subdomain)
    .eq("subdomainActive", true)
    .maybeSingle();

  if (error || !data) notFound();

  const row = data as unknown as ConsultantRow;
  const user = Array.isArray(row.user) ? row.user[0] : row.user;
  if (!user) notFound();

  const name = user.name || user.username || "Consultant";
  const bio = row.bio || `Consult with ${name} for guidance on relationships, career, and life.`;

  const services = [
    {title: "Chat", desc: "Per-minute text consultation", price: row.chatRate ?? 50},
    {title: "Audio Call", desc: "Live voice consultation", price: row.audioRate ?? 75},
    {title: "Video Call", desc: "Face-to-face video consultation", price: row.videoRate ?? 100},
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <section className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-light text-[#5E4B8B] mb-4">Welcome to {name}</h1>
        <p className="text-lg text-[#B8A1D9] max-w-2xl mx-auto">{bio}</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        {services.map((s) => (
          <div key={s.title} className="p-6 rounded-2xl border border-[#E1C5E7] bg-white">
            <h2 className="font-semibold text-[#5E4B8B] mb-1">{s.title}</h2>
            <p className="text-sm text-[#B8A1D9] mb-3">{s.desc}</p>
            <p className="text-lg font-bold" style={{color: "var(--wl-primary)"}}>
              ₹{s.price}/min
            </p>
          </div>
        ))}
      </section>

      <div className="text-center">
        <Link
          href={`/white-label/${subdomain}/book`}
          className="inline-block px-8 py-3 rounded-xl text-white font-medium shadow-lg"
          style={{background: "linear-gradient(135deg, var(--wl-primary), var(--wl-accent))"}}
        >
          Book a Session
        </Link>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
