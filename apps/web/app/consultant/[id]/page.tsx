import { getConsultantPublicProfile } from "@/actions/public";
import { ConsultantProfileClient } from "@/components/public/ConsultantProfileClient";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Metadata } from "next";

// Optional: Dynamic Metadata for SEO and Social Sharing
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const res = await getConsultantPublicProfile(resolvedParams.id);
  if (!res.success) return { title: "Not Found | Zeal" };
  return {
    title: `${res.profile?.full_name} | Zeal Consultant`,
    description: `Book a metaphysical session with ${res.profile?.full_name}.`,
  };
}

export default async function PublicConsultantPage({ params }: { params: Promise<{ id: string }> }) {
  // Await the asynchronous params object natively in Next.js 15+
  const resolvedParams = await params;
  const res = await getConsultantPublicProfile(resolvedParams.id);

  // Error Handling UI for invalid UUIDs or deactivated accounts
  if (!res.success || !res.profile) {
    return (
      <div className="min-h-screen-app bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mb-6 border border-rose-500/20">
          <ShieldAlert size={32} className="text-rose-500" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Consultant Unavailable</h1>
        <p className="text-slate-400 mb-8 max-w-sm">{res.error || "This profile may have been removed or deactivated by administration."}</p>
        <Link href="/explore" className="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-white font-bold transition-colors">
          Return to Directory
        </Link>
      </div>
    );
  }

  return <ConsultantProfileClient initialProfile={res.profile} posts={res.posts} />;
}
