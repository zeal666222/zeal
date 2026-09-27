"use client";
export const dynamic = "force-dynamic";

import {useParams, useRouter} from "next/navigation";
import { Home, MessageSquare, Sparkles } from "lucide-react";

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  return (
    <div className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-purple-400 mb-8"
        >
          <Home size={16} /> Return to Cosmos
        </button>

        <div className="bg-surface backdrop-blur-xl border border-border rounded-[2.5rem] p-8 sm:p-12 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
              C
            </div>
            <div>
              <h4 className="font-bold">Verified Consultant</h4>
              <p className="text-xs text-muted-foreground">Cosmos Feed Post #{id}</p>
            </div>
          </div>
          <p className="text-muted-foreground leading-relaxed text-lg mb-8 font-light">
            Planetary transits this week bring heightened intuition and structural clarity. Meditate upon your ascendant house to align with these frequencies.
          </p>
          <div className="flex items-center gap-2 text-purple-400 text-sm font-medium">
            <MessageSquare size={16} /> 12 Comments on Transmission
          </div>
        </div>
      </div>
    </div>
  );
}
