import { getConsultantDetails } from "@/actions/discovery";
import { notFound } from "next/navigation";
import { CallRequestButton } from "@/components/consultant/CallRequestButton";
import { ShieldCheck, Star, Video, MessageSquare, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function ConsultantProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile, posts, error } = await getConsultantDetails(id);

  if (error || !profile) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <Link href="/explore" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">
        <ArrowLeft size={16} /> Back to Explore
      </Link>

      {/* Profile Card */}
      <div className="bg-slate-900/90 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-600/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10 mb-8">
          <div className="w-28 h-28 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-5xl uppercase overflow-hidden shadow-xl shrink-0">
            {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" /> : profile.full_name.charAt(0)}
          </div>
          <div className="text-center sm:text-left flex-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-2">
              <ShieldCheck size={14} /> Verified Expert
            </div>
            <h1 className="text-3xl font-black text-white">{profile.full_name}</h1>
            <p className="text-slate-400 text-sm mt-1 leading-relaxed">{profile.system_prompt || "Specialized metaphysical guidance and consultations."}</p>
            
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-6">
              <CallRequestButton consultantId={profile.id} />
            </div>
          </div>
        </div>
      </div>

      {/* Consultant Posts */}
      <div>
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Expert Insights</h3>
        <div className="space-y-4">
          {posts.map((post: any) => (
            <div key={post.id} className="bg-slate-900/80 border border-white/10 rounded-2xl p-6">
              <p className="text-slate-300 text-sm mb-3">{post.content}</p>
              {post.image_url && (
                <div className="rounded-xl overflow-hidden border border-white/5 max-h-80">
                  <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          ))}
          {posts.length === 0 && (
            <p className="text-slate-500 text-xs italic text-center py-8">This expert has not published any insights yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
