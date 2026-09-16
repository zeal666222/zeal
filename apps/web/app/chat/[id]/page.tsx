import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/session/ChatInterface";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function DedicatedChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const sessionId = resolvedParams.id;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 1. Fetch Session and Associated Profiles (Symmetrical Query for strict TS)
  const { data: session, error } = await supabase
    .from("session_requests")
    .select(`
      id, status, seeker_id, consultant_id,
      seeker:profiles!session_requests_seeker_id_fkey(full_name, is_ai),
      consultant:profiles!session_requests_consultant_id_fkey(full_name, is_ai)
    `)
    .eq("id", sessionId)
    .single();

  if (error || !session) redirect("/chat");

  const isSeeker = user.id === session.seeker_id;
  const rawPartner = isSeeker ? session.consultant : session.seeker;
  
  // Explicitly cast to bypass Supabase dynamic join union limits
  const partner = (Array.isArray(rawPartner) ? rawPartner[0] : rawPartner) as any;

  const partnerName = partner?.full_name || "Consultant";
  const isAI = isSeeker ? Boolean(partner?.is_ai) : false;

  // 2. Fetch Chat History
  const { data: messages } = await supabase
    .from("session_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  return (
    <div className="fixed md:static inset-0 z-50 md:z-auto bg-slate-950 flex flex-col h-screen-app">
      {/* Mobile Back Button Bar */}
      <div className="md:hidden flex-none h-12 bg-slate-900 border-b border-white/10 px-4 flex items-center">
        <Link href="/chat" className="flex items-center gap-1 text-sm font-bold text-slate-300 hover:text-white">
          <ArrowLeft size={18} /> Direct
        </Link>
      </div>

      <div className="flex-1 h-full min-h-0">
        <ChatInterface
          sessionId={sessionId}
          currentUserId={user.id}
          initialMessages={messages || []}
          partnerName={partnerName}
          isAI={isAI}
        />
      </div>
    </div>
  );
}
