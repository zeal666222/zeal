"use client";
// Public profile actions — open a DM with the owner, or edit your own profile.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Edit3, Loader2, MessageCircle } from "lucide-react";
import { toast } from "@/components/ui/toaster";

export function PublicProfileActions({
  userId,
  isSelf = false,
}: {
  userId: string;
  isSelf?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (isSelf) {
    return (
      <Link
        href="/profile/edit"
        className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl
                   border border-border bg-surface
                   text-foreground text-xs font-black
                   hover:scale-[1.02] active:scale-[0.98] transition-transform"
      >
        <Edit3 size={14} />
        Edit profile
      </Link>
    );
  }

  const openDm = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId: userId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        conversationId?: string; error?: string;
      };
      if (!res.ok || !data.conversationId) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error(data.error ?? "Could not start chat");
      }
      router.push(`/chat/${data.conversationId}`);
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Could not start chat",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void openDm()}
      disabled={busy}
      className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl
                 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                 text-white text-xs font-black
                 shadow-lg shadow-[var(--color-primary-hover)]/20
                 hover:scale-[1.02] active:scale-[0.98] transition-transform
                 disabled:opacity-50"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
      Message
    </button>
  );
}
