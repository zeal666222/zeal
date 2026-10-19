"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Super Admin — Impersonate (Users / Consultants / AI Consultants)
// ═══════════════════════════════════════════════════════════════════════════════
// Enhanced impersonation with:
//   - Tabbed interface: Users | Consultants | AI Consultants
//   - Profile preview before impersonating
//   - Recent activity (last 5 messages, last session, last booking)
//   - Quick actions: send message, make booking, top up wallet
//   - Session log recording all actions during impersonation
// ═══════════════════════════════════════════════════════════════════════════════
import { toast } from "@/components/ui/toaster";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Search, ShieldAlert, UserCheck, Bot, UserCog, Users,
  MessageSquare, Calendar, Wallet, Clock, Eye, ArrowRight, Activity,
} from "lucide-react";

type TabType = "users" | "consultants" | "ai";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  role: string;
  avatar: string | null;
}

interface AIConsultantRow {
  id: string;
  name: string;
  avatar: string;
  category: string;
  bio: string;
  isPaid: boolean;
  perMinuteRate: number;
  isActive: boolean;
  specialties: string[];
}

interface ProfilePreview {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  role: string;
  avatar: string | null;
  createdAt: string;
  is_online: boolean;
  recentMessages: { content: string; createdAt: string }[];
  lastSession: { id: string; createdAt: string; duration: number } | null;
  lastBooking: { id: string; createdAt: string; status: string } | null;
}

interface SessionLogEntry {
  timestamp: string;
  action: string;
  target: string;
}

export default function ImpersonatePage() {
  const [tab, setTab] = useState<TabType>("users");
  const [search, setSearch] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const [previewUser, setPreviewUser] = useState<ProfilePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sessionLog, setSessionLog] = useState<SessionLogEntry[]>([]);

  // ─── Data fetching ──────────────────────────────────────────────────────────
  const { data: usersData, isLoading: usersLoading } = useQuery<{ users: UserRow[] }>({
    queryKey: ["admin", "users", "impersonate", search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "20" });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
    enabled: tab === "users" || tab === "consultants",
  });

  const { data: aiData, isLoading: aiLoading } = useQuery<{ items: AIConsultantRow[] }>({
    queryKey: ["admin", "ai-consultants", "impersonate"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ai-consultants", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load AI consultants");
      return res.json();
    },
    enabled: tab === "ai",
  });

  // ─── Profile preview ────────────────────────────────────────────────────────
  const loadPreview = useCallback(async (userId: string) => {
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/preview`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setPreviewUser(data);
      }
    } catch {
      // Non-fatal — preview is optional
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  // ─── Start impersonation ────────────────────────────────────────────────────
  const startImpersonation = async (
    targetId: string,
    targetType: "user" | "consultant" | "ai",
    targetName: string,
  ) => {
    setStarting(targetId);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: targetId,
          targetId,
          targetType,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: (err as { error?: string }).error || "Failed", variant: "destructive" });
        return;
      }
      const r = await res.json();

      // Log to session
      setSessionLog((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          action: `IMPERSONATE_${targetType.toUpperCase()}_START`,
          target: targetName,
        },
      ]);

      sessionStorage.setItem("zeal-impersonate", JSON.stringify({
        targetUserId: r.targetUserId ?? r.targetId,
        targetName: r.targetName,
        targetType,
        expiresAt: r.expiresAt,
      }));

      toast({
        title: `Impersonating ${targetName}`,
        description: "15-minute session started. All actions are audited.",
      });

      // Redirect based on type
      if (targetType === "ai") {
        window.location.href = "/admin/consultant/dashboard";
      } else {
        window.location.href = "/admin/consultant/dashboard";
      }
    } finally {
      setStarting(null);
    }
  };

  const users = usersData?.users ?? [];
  const aiConsultants = aiData?.items ?? [];
  const isLoading = tab === "ai" ? aiLoading : usersLoading;

  const tabs: { key: TabType; label: string; icon: typeof Users; count?: number }[] = [
    { key: "users", label: "Users", icon: Users, count: users.length },
    { key: "consultants", label: "Consultants", icon: UserCog },
    { key: "ai", label: "AI Consultants", icon: Bot, count: aiConsultants.length },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-foreground flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-rose-600 dark:text-rose-400" /> Impersonate
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Act as any user, consultant, or AI persona for 15 minutes. Every action is audited.
        </p>
      </div>

      {/* ─── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-surface border border-border rounded-xl w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setPreviewUser(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === t.key
                ? "bg-rose-500/15 text-rose-400"
                : "text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon size={13} />
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1 text-[10px] opacity-60">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Search ────────────────────────────────────────────────────────── */}
      {tab !== "ai" && (
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder={tab === "consultants" ? "Search consultants..." : "Search by email, name, or username..."}
            className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-rose-500/50" />
        </div>
      )}

      {/* ─── Content ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: List */}
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-rose-600 dark:text-rose-400" />
            </div>
          ) : tab === "ai" ? (
            aiConsultants.length === 0 ? (
              <EmptyState text="No AI consultants configured" />
            ) : (
              <div className="space-y-2">
                {aiConsultants.map((ai) => (
                  <div key={ai.id}
                    className="flex items-center gap-3 p-4 bg-surface border border-border rounded-2xl hover:border-rose-500/30 transition-all cursor-pointer"
                    onClick={() => setPreviewUser(null)}>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white font-bold overflow-hidden">
                      {ai.avatar ? <img src={ai.avatar} alt="" className="w-full h-full object-cover" /> :
                        ai.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{ai.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{ai.category} {ai.isPaid ? `· ₹${ai.perMinuteRate}/min` : "· Free"}</p>
                    </div>
                    <div className="hidden md:flex items-center gap-1">
                      {ai.specialties.slice(0, 2).map((s) => (
                        <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">{s}</span>
                      ))}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); startImpersonation(ai.id, "ai", ai.name); }}
                      disabled={starting === ai.id}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-700 text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
                      {starting === ai.id ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
                      Talk as AI
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            users.length === 0 ? (
              <EmptyState text="No users found" />
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.id}
                    className="flex items-center gap-3 p-4 bg-surface border border-border rounded-2xl hover:border-rose-500/30 transition-all cursor-pointer"
                    onClick={() => void loadPreview(u.id)}>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-bold overflow-hidden">
                      {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> :
                        (u.name || u.username || u.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{u.name || u.username || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-surface-raised text-muted-foreground border border-border">
                      {u.role}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); startImpersonation(u.id, tab === "consultants" ? "consultant" : "user", u.name || u.email); }}
                      disabled={starting === u.id}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
                      {starting === u.id ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />}
                      Impersonate
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Right: Preview + Quick Actions + Session Log */}
        <div className="space-y-4">
          {/* Profile Preview */}
          <div className="rounded-2xl border border-border bg-surface p-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-3">
              <Eye size={12} /> Profile Preview
            </h3>
            {loadingPreview ? (
              <div className="flex justify-center py-8">
                <Loader2 size={16} className="animate-spin text-muted-foreground" />
              </div>
            ) : previewUser ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-bold overflow-hidden">
                    {previewUser.avatar ? <img src={previewUser.avatar} alt="" className="w-full h-full object-cover" /> :
                      (previewUser.name || previewUser.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{previewUser.name || previewUser.username || "—"}</p>
                    <p className="text-xs text-muted-foreground">{previewUser.email}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${previewUser.is_online ? "bg-emerald-400" : "bg-slate-500"}`} />
                      <span className="text-[10px] text-muted-foreground">{previewUser.is_online ? "Online" : "Offline"}</span>
                    </div>
                  </div>
                </div>

                {/* Recent messages */}
                {previewUser.recentMessages.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Recent messages</p>
                    <div className="space-y-1">
                      {previewUser.recentMessages.slice(0, 3).map((m, i) => (
                        <p key={i} className="text-xs text-foreground/70 truncate pl-2 border-l-2 border-border">
                          {m.content}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Last session */}
                {previewUser.lastSession && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock size={11} />
                    Last session: {new Date(previewUser.lastSession.createdAt).toLocaleDateString()} ({previewUser.lastSession.duration}min)
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">
                Click a user to preview their profile
              </p>
            )}
          </div>

          {/* Quick Actions */}
          {previewUser && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-3">
                <Activity size={12} /> Quick Actions
              </h3>
              <div className="space-y-1.5">
                <QuickAction icon={MessageSquare} label="Send message as this user" href={`/chat?impersonate=${previewUser.id}`} />
                <QuickAction icon={Calendar} label="Make a booking" href={`/admin/consultants?impersonate=${previewUser.id}`} />
                <QuickAction icon={Wallet} label="Top up wallet" href={`/admin/wallet?impersonate=${previewUser.id}`} />
              </div>
            </motion.div>
          )}

          {/* Session Log */}
          {sessionLog.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-3">
                <Clock size={12} /> Session Log
              </h3>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {sessionLog.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-muted-foreground font-mono text-[10px] shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-foreground/80">{entry.action}: {entry.target}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-16 border-2 border-dashed border-border rounded-3xl text-muted-foreground">
      {text}
    </div>
  );
}

function QuickAction({ icon: Icon, label, href }: { icon: typeof MessageSquare; label: string; href: string }) {
  return (
    <a href={href}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-all group">
      <Icon size={13} className="text-muted-foreground group-hover:text-rose-400" />
      <span className="flex-1">{label}</span>
      <ArrowRight size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}
