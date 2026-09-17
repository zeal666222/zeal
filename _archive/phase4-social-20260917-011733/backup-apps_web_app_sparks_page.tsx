"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, Sparkles, Activity, ArrowLeft, Loader2, Heart, MessageCircle, UserPlus } from "lucide-react";
import { useSparks } from "@/hooks/useSparks";

interface SparkActivity {
  id: string;
  type: "cheer";
  actor: { id: string; username: string; avatar: string | null };
  target: { id: string; content: string };
  sparksEarned: number;
  createdAt: string;
}

function formatRelative(ts: string): string {
  const d = new Date(ts).getTime();
  const diff = Math.max(0, Date.now() - d);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function SparksPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [initialSparks, setInitialSparks] = useState(0);
  const [activities, setActivities] = useState<SparkActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const { sparks, lastDelta } = useSparks(userId, initialSparks);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [profileRes, feedRes] = await Promise.all([
          fetch("/api/users/me/profile", { cache: "no-store" }),
          fetch("/api/sparks/feed?limit=40", { cache: "no-store" }),
        ]);
        if (!cancelled && profileRes.ok) {
          const data = await profileRes.json();
          if (data?.user?.id) setUserId(data.user.id);
          if (typeof data?.user?.sparks === "number") setInitialSparks(data.user.sparks);
        }
        if (!cancelled && feedRes.ok) {
          const data = await feedRes.json();
          if (Array.isArray(data?.activities)) setActivities(data.activities);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen-app bg-slate-950 text-slate-50 px-4 py-6 pb-24">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#9D7DC5] mb-4 transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </Link>

        {/* Spark score hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-950/40 via-slate-900 to-slate-950 border border-orange-500/20 p-6 md:p-8 mb-6 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold mb-4">
              <Sparkles size={12} /> Social Proof
            </div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">
              Your Spark Score
            </p>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl md:text-6xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">
                {sparks.toLocaleString()}
              </span>
              {lastDelta !== null && (
                <span className={`text-lg font-black ${lastDelta > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {lastDelta > 0 ? "+" : ""}{lastDelta}
                </span>
              )}
            </div>
            <p className="text-slate-500 text-xs mt-3">
              Earned from cheers, comments, and follows on your posts
            </p>
          </div>
        </div>

        {/* Activity feed */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-[#9D7DC5]" />
            <h2 className="text-base md:text-lg font-bold text-white">Recent Activity</h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#9D7DC5]" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12">
              <Flame size={32} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No activity yet — share a post to earn Sparks</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-[#9D7DC5]/20 flex items-center justify-center flex-shrink-0 text-[#9D7DC5]">
                    <Heart size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">
                      <span className="font-bold">@{a.actor.username}</span> cheered your post
                    </p>
                    {a.target.content && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        "{a.target.content}"
                      </p>
                    )}
                    <p className="text-[10px] text-slate-500 mt-1">
                      {formatRelative(a.createdAt)} · +{a.sparksEarned} Spark
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}