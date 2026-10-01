import Link from "next/link";
import { redirect } from "next/navigation";
import { Send, Sparkles } from "lucide-react";
import {
  createServerClientFromCookies,
  createAdminClient,
} from "@zeal/database/server";

export const dynamic = "force-dynamic";

interface ChatIndexProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ChatIndexPage({ searchParams }: ChatIndexProps) {
  const sp = await searchParams;
  const consultantId = typeof sp.consultantId === "string" ? sp.consultantId : null;

  // ─── Resume the chat funnel (e.g. after a wallet top-up) ─────────────────
  if (consultantId) {
    const supabase = await createServerClientFromCookies();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const admin = createAdminClient();
      let partnerUserId: string | null = null;

      const { data: aiRow } = await admin
        .from("AIConsultant")
        .select("id")
        .eq("id", consultantId)
        .maybeSingle();
      if (aiRow) {
        partnerUserId = (aiRow as { id: string }).id;
      } else {
        const { data: cRow } = await admin
          .from("Consultant")
          .select("userId")
          .eq("id", consultantId)
          .maybeSingle();
        partnerUserId = (cRow as { userId: string } | null)?.userId ?? null;
      }

      if (partnerUserId && partnerUserId !== user.id) {
        const { data: conversationId } = await supabase.rpc(
          "get_or_create_conversation",
          { p_user_a: user.id, p_user_b: partnerUserId },
        );
        if (conversationId) redirect(`/chat/${conversationId}`);
      }
    }
    redirect("/explore");
  }

  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center bg-background relative overflow-hidden">
      {/* Subtle Background Glow */}
      <div className="absolute w-[450px] h-[450px] bg-purple-600/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-sm flex flex-col items-center">
        <div className="w-24 h-24 rounded-full bg-surface border border-border flex items-center justify-center mb-6 shadow-2xl relative">
          <div className="absolute inset-0 rounded-full border border-purple-500/20 animate-ping opacity-30" />
          <Send size={36} className="text-purple-400 translate-x-0.5 -translate-y-0.5" />
        </div>

        <h2 className="text-2xl font-black text-foreground tracking-tight mb-2">
          Your Direct Messages
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed mb-6">
          Send private astrological inquiries, review previous readings, or establish real-time video sessions.
        </p>

        <Link
          href="/explore"
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-600/20 transition-all active:scale-95 flex items-center gap-2"
        >
          <Sparkles size={16} /> Explore Consultants
        </Link>
      </div>
    </div>
  );
}
