// ═══════════════════════════════════════════════════════════════════════════════
// White-Label Services — direct Supabase query
// ═══════════════════════════════════════════════════════════════════════════════
import {notFound} from "next/navigation";
import {createAdminClient} from "@zeal/database/server";
import Link from "next/link";

interface Props {
  params: Promise<{subdomain: string}>;
}

interface ConsultantRow {
  chatRate: number | null;
  audioRate: number | null;
  videoRate: number | null;
  physicalRate: number | null;
}

export default async function WhiteLabelServicesPage({params}: Props) {
  const {subdomain} = await params;
  const admin = createAdminClient();

  const {data, error} = await admin
    .from("Consultant")
    .select('"chatRate", "audioRate", "videoRate", "physicalRate", "subdomainActive"')
    .eq("subdomain", subdomain)
    .eq("subdomainActive", true)
    .maybeSingle();

  if (error || !data) notFound();

  const row = data as unknown as ConsultantRow;

  const services = [
    {key: "chat", label: "Chat Consultation", rate: row.chatRate},
    {key: "audio", label: "Audio Call", rate: row.audioRate},
    {key: "video", label: "Video Consultation", rate: row.videoRate},
    {key: "physical", label: "In-Person Session", rate: row.physicalRate},
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-light text-[#5E4B8B] mb-8">Services</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((s) => (
          <div key={s.key} className="p-6 rounded-2xl border border-[#E1C5E7] bg-white">
            <h2 className="font-semibold text-[#5E4B8B] mb-1">{s.label}</h2>
            <p className="text-sm text-[#B8A1D9] mb-4">
              {s.rate ? `₹${s.rate}/min` : "Contact for pricing"}
            </p>
            <Link
              href={`/white-label/${subdomain}/book?service=${s.key}`}
              className="inline-block px-4 py-2 rounded-xl text-sm font-medium"
              style={{color: "var(--wl-primary)", background: "rgba(157,125,197,0.1)"}}
            >
              Book →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
