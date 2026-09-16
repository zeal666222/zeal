import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Link from "next/link";
import { Star, ShieldCheck, Sparkles, Compass } from "lucide-react";

export default async function ExplorePage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  // Fetch all approved consultants (Human and AI)
  const { data: consultants, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, cover_url, is_ai, is_online")
    .eq("role", "consultant");

  return (
    <div className="min-h-full flex flex-col p-4 sm:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-4">
          <Compass size={14} /> Global Registry
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">Explore Guides</h1>
        <p className="text-slate-400 mt-2 text-sm max-w-xl">
          Discover certified metaphysical experts and highly developed AI Personas ready to provide instant clarity.
        </p>
      </div>

      {error || !consultants || consultants.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-white/10 rounded-[2.5rem]">
          <p className="text-slate-400 font-bold">No consultants are currently active on the platform.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {consultants.map((consultant) => (
            <Link 
              key={consultant.id} 
              href={`/consultant/${consultant.id}`}
              className="group bg-slate-900 border border-white/5 rounded-[2rem] overflow-hidden hover:border-white/20 transition-all hover:-translate-y-1 shadow-xl block"
            >
              {/* Cover Photo */}
              <div className="h-32 bg-slate-800 relative">
                {consultant.cover_url ? (
                  <img src={consultant.cover_url} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-slate-900 to-purple-950" />
                )}
                {/* Status Indicator */}
                <div className={`absolute top-4 right-4 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider backdrop-blur-md ${consultant.is_online ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'}`}>
                  {consultant.is_online ? 'Online' : 'Offline'}
                </div>
              </div>

              {/* Profile Details */}
              <div className="p-5 relative">
                {/* Avatar overlapping cover */}
                <div className="absolute -top-10 left-5 w-16 h-16 rounded-full border-4 border-slate-900 bg-slate-800 overflow-hidden">
                  {consultant.avatar_url ? (
                    <img src={consultant.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-black text-white text-xl bg-indigo-600">
                      {consultant.full_name.charAt(0)}
                    </div>
                  )}
                </div>

                <div className="mt-8">
                  <h3 className="font-black text-lg text-white flex items-center gap-2">
                    {consultant.full_name}
                    {consultant.is_ai && <Sparkles size={14} className="text-purple-400" />}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5 text-xs font-bold">
                    <span className="flex items-center gap-1 text-amber-400"><Star size={12} className="fill-amber-400"/> 5.0</span>
                    <span className="text-slate-600">•</span>
                    <span className="flex items-center gap-1 text-indigo-400"><ShieldCheck size={12}/> Verified</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
