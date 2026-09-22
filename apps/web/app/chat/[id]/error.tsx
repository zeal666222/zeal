"use client";
import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function ChatRoomError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[chat-room-error]", { message: error.message, digest: error.digest }); }, [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-rose-400" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Chat couldn't load</h2>
      <p className="text-sm text-slate-400 mb-2 max-w-md">{error.message || "Something went wrong."}</p>
      {error.digest && <p className="text-xs text-slate-600 font-mono mb-4">Digest: {error.digest}</p>}
      <div className="flex gap-3">
        <button onClick={reset} className="px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold flex items-center gap-2">
          <RefreshCw size={14} /> Retry
        </button>
        <Link href="/chat" className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm font-bold">Back to inbox</Link>
      </div>
    </div>
  );
}
