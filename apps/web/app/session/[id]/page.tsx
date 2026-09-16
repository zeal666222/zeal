import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/session/ChatInterface";

export default async function SessionRoomPage({ params }: { params: Promise<{ id: string }> }) {
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

  // Verify Session & Fetch Details
  const { data: session, error } = await supabase
    .from("session_requests")
    .select(`
      id, status, seeker_id, consultant_id,
      seeker:profiles!session_requests_seeker_id_fkey(full_name),
      consultant:profiles!session_requests_consultant_id_fkey(full_name, is_ai)
    `)
    .eq("id", sessionId)
    .single();

  if (error || !session) redirect("/explore");

  // Determine the partner's info based on who is logged in
  const isSeeker = user.id === session.seeker_id;
  const partnerName = isSeeker ? (session.consultant as any)?.full_name : (session.seeker as any)?.full_name;
  const isAI = isSeeker ? (session.consultant as any)?.is_ai : false;

  // Fetch Historical Messages
  const { data: messages } = await supabase
    .from("session_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  return (
    <ChatInterface 
      sessionId={sessionId}
      currentUserId={user.id}
      initialMessages={messages || []}
      partnerName={partnerName || "Unknown"}
      isAI={isAI}
    />
  );
}
