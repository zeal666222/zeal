"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// ChatInterface — Industry-grade premium chat with glassmorphism, spring physics,
// kundali chart, info bars, and high-end micro-interactions
// ═══════════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, ArrowLeft, CheckCheck, ChevronUp, Coins, Heart, Home,
  Loader2, MessageCircle, Moon, Paperclip, Send, ShieldCheck, Sparkles,
  Briefcase, Clock, BarChart3, WifiOff, X, Trash2, MapPin, Calendar,
  Timer, Star, Zap, Crown,
} from "lucide-react";
import Image from "next/image";
import { useChat, type BillingInfo, type ChatMessage, type StageEvent, type Suggestion } from "@/hooks/useChat";
import { useTyping } from "@/hooks/useTyping";
import { useConnection } from "@zeal/realtime";
import { BillingPanel } from "./BillingPanel";
import { WalletGateDialog, type WalletGateInfo } from "@/components/billing/WalletGateDialog";
import { BirthIntakeModal } from "@/components/chat/BirthIntakeModal";
import { useRoomIntake } from "@/lib/chat/use-room-intake";
import { cn, BrandLoader, PendingDot, StreamingIndicator } from "@zeal/ui";
import { ChatWelcomeSuggestions } from "./ChatWelcomeSuggestions";
import { ChatKundaliChart, type ChatKundaliData } from "@/components/astrology/ChatKundaliChart";
import { computeKundali } from "@/lib/kundali/engine";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface Props {
  conversationId: string;
  currentUserId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string | null;
  isAI?: boolean;
  rate?: number;
  activeSessionId?: string | null;
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

function MessageContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-2">
          {listItems}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };

  const parseInline = (text: string, keyPrefix: string): React.ReactNode => {
    const parts = text.split(/(!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, i) => {
      const imgMatch = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imgMatch) {
        return (
          <img
            key={`${keyPrefix}-img-${i}`}
            src={imgMatch[2]}
            alt={imgMatch[1] || "attachment"}
            className="max-w-full rounded-xl border border-border/50 my-2"
            loading="lazy"
          />
        );
      }
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return (
          <a
            key={`${keyPrefix}-link-${i}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[var(--color-primary)] underline underline-offset-2 text-xs"
          >
            <Paperclip size={10} /> {linkMatch[1]}
          </a>
        );
      }
      if (!part.trim()) return null;

      const formatted = part.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((segment, j) => {
        if (segment.startsWith("**") && segment.endsWith("**")) {
          return <strong key={`${keyPrefix}-b-${j}`} className="font-bold">{segment.slice(2, -2)}</strong>;
        }
        if (segment.startsWith("*") && segment.endsWith("*") && !segment.startsWith("**")) {
          return <em key={`${keyPrefix}-i-${j}`} className="italic">{segment.slice(1, -1)}</em>;
        }
        if (segment.startsWith("`") && segment.endsWith("`")) {
          return <code key={`${keyPrefix}-c-${j}`} className="px-1.5 py-0.5 rounded bg-surface-raised text-xs font-mono">{segment.slice(1, -1)}</code>;
        }
        return <span key={`${keyPrefix}-t-${j}`}>{segment}</span>;
      });
      return <span key={`${keyPrefix}-p-${i}`}>{formatted}</span>;
    });
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      elements.push(<br key={`br-${idx}`} />);
      return;
    }

    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={`h3-${idx}`} className="text-base font-bold mt-3 mb-1">
          {parseInline(trimmed.slice(4), `h3-${idx}`)}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={`h2-${idx}`} className="text-lg font-bold mt-3 mb-1">
          {parseInline(trimmed.slice(3), `h2-${idx}`)}
        </h2>
      );
      return;
    }
    if (trimmed.startsWith("# ")) {
      flushList();
      elements.push(
        <h1 key={`h1-${idx}`} className="text-xl font-bold mt-3 mb-1">
          {parseInline(trimmed.slice(2), `h1-${idx}`)}
        </h1>
      );
      return;
    }

    if (trimmed.match(/^[-*]\s+/)) {
      inList = true;
      listItems.push(
        <li key={`li-${idx}`} className="text-sm">
          {parseInline(trimmed.replace(/^[-*]\s+/, ""), `li-${idx}`)}
        </li>
      );
      return;
    }

    if (trimmed.match(/^\d+\.\s+/)) {
      flushList();
      elements.push(
        <div key={`ol-${idx}`} className="flex gap-2 my-1">
          <span className="font-bold text-sm min-w-[1.5em]">{trimmed.match(/^\d+/)?.[0]}.</span>
          <span className="flex-1 text-sm">{parseInline(trimmed.replace(/^\d+\.\s+/, ""), `ol-${idx}`)}</span>
        </div>
      );
      return;
    }

    flushList();
    elements.push(
      <p key={`p-${idx}`} className="my-1">
        {parseInline(trimmed, `p-${idx}`)}
      </p>
    );
  });

  flushList();

  return <div className="space-y-0.5">{elements}</div>;
}

const AI_QUICK_REPLIES = [
  "What is my Sun sign?",
  "Tell me about my career",
  "I'd like a compatibility reading",
  "Today's Horoscope",
  "Analyze my Dasha period",
];

function SuggestionIcon({ name }: { name?: Suggestion["icon"] }) {
  const cls = "w-3 h-3 shrink-0 opacity-80";
  switch (name) {
    case "heart": return <Heart className={cls} />;
    case "briefcase": return <Briefcase className={cls} />;
    case "moon": return <Moon className={cls} />;
    case "clock": return <Clock className={cls} />;
    case "chart": return <BarChart3 className={cls} />;
    case "sparkle":
    default: return <Sparkles className={cls} />;
  }
}

export function ChatInterface({
  conversationId,
  currentUserId,
  partnerId,
  partnerName,
  partnerAvatar,
  isAI = false,
  rate = 0,
  activeSessionId = null,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sessionId, setSessionId] = useState<string | null>(
    searchParams.get("session") ?? activeSessionId,
  );
  const [liveRate, setLiveRate] = useState<number>(rate);
  const [walletGate, setWalletGate] = useState<WalletGateInfo | null>(null);

  const { messages, isLoading, isSending, send, sendToAI, hasMore, isLoadingOlder, loadOlder } = useChat({
    conversationId,
    currentUserId,
    partnerId,
    partnerName,
    partnerAvatar,
    isAI,
  });
  const connection = useConnection();
  const intake = useRoomIntake(isAI);
  const { typingUsers, setTyping } = useTyping(conversationId, currentUserId);

  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [fillerText, setFillerText] = useState<string | null>(null);
  const [streamingStage, setStreamingStage] = useState<StageEvent | null>(null);
  const [completedStages, setCompletedStages] = useState<StageEvent[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [terminationReason, setTerminationReason] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [failedText, setFailedText] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const prevHeightRef = useRef(0);
  const inFlightRef = useRef(false);
  const openerFiredRef = useRef(false);
  const [kundaliChart, setKundaliChart] = useState<ChatKundaliData | null>(null);
  const [seekerName, setSeekerName] = useState<string | undefined>();
  const [birthInfo, setBirthInfo] = useState<{ dob?: string; tob?: string; pob?: string } | null>(null);

  // Smart autoscroll
  useEffect(() => {
    const last = messages[messages.length - 1];
    const mine = last?.senderId === currentUserId;
    if (nearBottomRef.current || mine || streamingText !== null || fillerText !== null) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length, streamingText, fillerText, typingUsers.size, currentUserId, messages, kundaliChart]);

  // Load-older scroll restore
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isLoadingOlder || !prevHeightRef.current) return;
    el.scrollTop += el.scrollHeight - prevHeightRef.current;
    prevHeightRef.current = 0;
  }, [messages.length, isLoadingOlder]);

  const handleLoadOlder = async () => {
    const el = scrollRef.current;
    prevHeightRef.current = el?.scrollHeight ?? 0;
    await loadOlder();
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  };

  // Seen receipts
  const [partnerReadAt, setPartnerReadAt] = useState<string | null>(null);
  useEffect(() => {
    if (isAI || !conversationId) return;
    let cancelled = false;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/chat/${conversationId}/read`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { participants?: Array<{ userId: string; lastReadAt: string | null }> };
        if (cancelled) return;
        const other = (data.participants ?? []).find((p) => p.userId !== currentUserId);
        setPartnerReadAt(other?.lastReadAt ?? null);
      } catch { /* receipts are best-effort */ }
    };
    void check();
    const id = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [isAI, conversationId, currentUserId]);

  useEffect(() => {
    if (isAI || !conversationId || messages.length === 0) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    void fetch(`/api/chat/${conversationId}/read`, { method: "POST" }).catch(() => {});
  }, [conversationId, messages.length, isAI]);

  useEffect(() => {
    void fetch(`/api/chat/${conversationId}/read`, { method: "POST" }).catch(() => {});
  }, [conversationId]);

  // Clear transitioning overlay
  useEffect(() => {
    if (intake.transitioning && (isLoading || messages.length > 0 || inFlightRef.current)) {
      intake.clearTransition();
    }
  }, [intake.transitioning, isLoading, messages.length, intake.clearTransition]);

  // Mobile keyboard handling
  useEffect(() => {
    if (!window.visualViewport) return;
    const vv = window.visualViewport;
    const handler = () => {
      const offsetBottom = window.innerHeight - vv.height - vv.offsetTop;
      document.documentElement.style.setProperty("--kb-offset", `${offsetBottom}px`);
    };
    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
  }, []);

  // AI chat: fetch birth profile and compute kundali chart
  useEffect(() => {
    if (!isAI) return;
    let cancelled = false;
    const fetchAndCompute = async () => {
      try {
        const res = await fetch("/api/profile/birth", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json() as { profile?: { fullName?: string; dateOfBirth?: string; timeOfBirth?: string; placeOfBirth?: string; latitude?: number; longitude?: number; timezone?: string } | null };
        if (cancelled) return;
        const profile = data?.profile;
        if (!profile?.dateOfBirth || !profile?.placeOfBirth) return;
        if (profile.latitude == null || profile.longitude == null) return;
        if (kundaliChart) return;
        const result = computeKundali(
          profile.fullName ?? "Seeker",
          profile.dateOfBirth,
          profile.timeOfBirth ?? "00:00",
          profile.placeOfBirth,
          {
            lat: profile.latitude,
            lng: profile.longitude,
            timezone: profile.timezone ?? "Asia/Kolkata",
            canonicalName: profile.placeOfBirth,
            country: "",
            source: "gazetteer",
          },
        );
        if (cancelled) return;
        setKundaliChart({
          ascendantSign: result.chart.ascendantSign,
          houses: result.chart.houses,
          planets: result.chart.planets.map((p) => ({
            planet: p.planet,
            sign: p.sign,
            signIndex: p.signIndex,
            house: p.house,
            degree: p.degree,
            isRetrograde: p.isRetrograde,
          })),
          nakshatra: result.panchanga.nakshatra,
          dasha: {
            mahadasha: result.dasha.currentMahadasha,
            antardasha: result.dasha.currentAntardasha,
            remaining: result.dasha.remainingYears,
          },
        });
        setSeekerName(profile.fullName ?? undefined);
        setBirthInfo({
          dob: profile.dateOfBirth,
          tob: profile.timeOfBirth ?? undefined,
          pob: profile.placeOfBirth,
        });
      } catch { /* best-effort */ }
    };
    void fetchAndCompute();
    return () => { cancelled = true; };
  }, [isAI]);

  const handleBilling = (billing: BillingInfo) => {
    if (billing.sessionId) setSessionId(billing.sessionId);
    if (typeof billing.rate === "number" && billing.rate > 0) setLiveRate(billing.rate);
    if (billing.success === false && billing.error === "insufficient_balance") {
      setWalletGate({
        balance: Number(billing.available ?? 0),
        required: Number(billing.required ?? billing.rate ?? liveRate ?? 0),
        consultantName: partnerName,
        consultantId: partnerId,
      });
    }
  };

  const uploadFiles = async (files: File[]): Promise<Array<{ url: string; name: string; mime: string }>> => {
    const results: Array<{ url: string; name: string; mime: string }> = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Upload failed: ${file.name}`);
      const data = await res.json();
      results.push({ url: data.url, name: file.name, mime: data.mime ?? file.type });
    }
    return results;
  };

  const streamAI = async (content: string, isOpener: boolean) => {
    setStreamingText("");
    setFillerText(null);
    setStreamingStage(null);
    setCompletedStages([]);
    setSuggestions([]);
    await sendToAI(partnerId, content, {
      onDelta: (acc) => { setStreamingText(acc); setFillerText(null); },
      onFiller: (f) => setFillerText(f),
      onBilling: handleBilling,
      onStage: (stage) => {
        setStreamingStage(stage);
        setCompletedStages((prev) => {
          if (prev.some((p) => p.index === stage.index)) return prev;
          return [...prev, stage];
        });
      },
      onStageDone: () => setStreamingStage(null),
      onSuggestions: (s) => setSuggestions(s),
      onProfileUpdated: intake.applyProfileUpdate,
      onKundaliChart: (birth) => {
        if (birth.latitude == null || birth.longitude == null) return;
        try {
          const result = computeKundali(
            birth.name ?? "Seeker",
            birth.dob,
            birth.tob,
            birth.pob,
            {
              lat: birth.latitude,
              lng: birth.longitude,
              timezone: birth.timezone ?? "Asia/Kolkata",
              canonicalName: birth.pob,
              country: "",
              source: "gazetteer",
            },
          );
          setKundaliChart({
            ascendantSign: result.chart.ascendantSign,
            houses: result.chart.houses,
            planets: result.chart.planets.map((p) => ({
              planet: p.planet,
              sign: p.sign,
              signIndex: p.signIndex,
              house: p.house,
              degree: p.degree,
              isRetrograde: p.isRetrograde,
            })),
            nakshatra: result.panchanga.nakshatra,
            dasha: {
              mahadasha: result.dasha.currentMahadasha,
              antardasha: result.dasha.currentAntardasha,
              remaining: result.dasha.remainingYears,
            },
          });
          setSeekerName(birth.name ?? undefined);
          setBirthInfo({ dob: birth.dob, tob: birth.tob, pob: birth.pob });
        } catch { /* invalid birth data — skip chart */ }
      },
    }, 0, isOpener);
    setStreamingText(null);
    setFillerText(null);
    setStreamingStage(null);
  };

  // Auto-opener
  useEffect(() => {
    if (!isAI || isLoading || !intake.ready || intake.open || openerFiredRef.current) return;
    if (messages.length > 0 || inFlightRef.current || isSending) return;
    openerFiredRef.current = true;
    inFlightRef.current = true;
    void (async () => {
      try {
        await streamAI("", true);
      } catch {
        openerFiredRef.current = false;
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [isAI, isLoading, messages.length, intake.ready, intake.open]);

  const deliver = async (messageText: string, restoreText: string) => {
    if (inFlightRef.current || isSending) return;
    inFlightRef.current = true;
    try {
      if (isAI) {
        await streamAI(messageText, false);
      } else {
        const result = await send(messageText);
        if (result?.billing) handleBilling(result.billing);
        const b = result?.billing;
        if (b && b.success === false && b.error === "insufficient_balance") {
          setInput((cur) => (cur ? cur : restoreText));
        }
      }
      setSendError(null);
      setFailedText(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setSendError(
        msg.includes("insufficient_balance")
          ? "Low wallet balance — recharge and send again."
          : msg.includes("rate limit")
            ? "You hit a rate limit — please wait a moment and try again."
            : "Message wasn't sent. Try again.",
      );
      setInput((cur) => (cur ? cur : restoreText));
      setFailedText(messageText);
      setStreamingText(null);
      setFillerText(null);
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (uploading || (!text && attachments.length === 0) || isSending || inFlightRef.current) return;
    setSendError(null);
    setFailedText(null);
    setInput("");
    setTyping(false);

    let messageText = text;
    let uploadedFiles: Array<{ url: string; name: string; mime: string }> = [];

    if (attachments.length > 0) {
      setUploading(true);
      try {
        uploadedFiles = await uploadFiles(attachments);
        const fileLines = uploadedFiles
          .map((f) => {
            const isImage = f.mime.startsWith("image/");
            return isImage
              ? `![${f.name}](${f.url})`
              : `[${f.name}](${f.url})`;
          })
          .join("\n");
        messageText = text
          ? `${text}\n\n${fileLines}`
          : fileLines;
      } catch (err) {
        setSendError(err instanceof Error ? err.message : "Upload failed. Please try again.");
        setInput((cur) => (cur ? cur : text));
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    clearAttachments();
    await deliver(messageText, text);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (!isAI) setTyping(e.target.value.length > 0);
  };

  const handleSessionEnd = () => {
    setSessionId(null);
    setTerminationReason(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const next = [...attachments, ...files].slice(0, 5);
    setAttachments(next);
    const urls = next.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : ""));
    setPreviewUrls(urls);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearAttachments = () => {
    previewUrls.filter(Boolean).forEach((url) => URL.revokeObjectURL(url));
    setAttachments([]);
    setPreviewUrls([]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const handleDeleteConversation = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/chat/${conversationId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.push("/chat");
    } catch {
      setSendError("Failed to delete conversation. Please try again.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const showTyping = !isAI && typingUsers.size > 0;
  const showStreaming = isAI && streamingText !== null;
  const lastMine = [...messages].reverse().find((m) => m.senderId === currentUserId && !m._optimistic);
  const isSeen = !isAI
    && !!partnerReadAt
    && !!lastMine
    && new Date(partnerReadAt).getTime() >= new Date(lastMine.createdAt).getTime();
  const streamDisplay = showStreaming
    ? streamingText || (fillerText ? `${fillerText}` : "")
    : "";

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background via-background to-surface/30 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-40 -right-40 w-96 h-96 bg-[var(--color-primary)]/5 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.15, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl"
        />
      </div>

      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="flex-none h-16 bg-surface/80 backdrop-blur-2xl border-b border-border/50 px-3 md:px-4 flex items-center justify-between z-20 relative"
      >
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Link
            href="/"
            aria-label="Home"
            title="Home"
            className="shrink-0 p-2 rounded-xl hover:bg-surface-raised active:scale-95 text-foreground transition-all"
          >
            <Home size={18} />
          </Link>
          <button
            type="button"
            onClick={() => router.push("/chat")}
            className="md:hidden p-2 -ml-1 rounded-xl hover:bg-surface-raised active:scale-95 transition-all"
            aria-label="Back to inbox"
          >
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <div className="relative group">
            <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-[var(--color-primary)]/20 to-violet-500/20 flex items-center justify-center font-black text-foreground overflow-hidden shrink-0 ring-2 ring-[var(--color-primary)]/30">
              {partnerAvatar ? (
                <Image src={partnerAvatar} alt={partnerName} fill sizes="48px" className="object-cover" />
              ) : (
                <span className="text-lg">{partnerName.charAt(0).toUpperCase()}</span>
              )}
              {isAI && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-violet-500 flex items-center justify-center"
                >
                  <Sparkles size={9} className="text-white" />
                </motion.div>
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-background" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-foreground text-sm flex items-center gap-2 truncate">
              {partnerName}
              {isAI && <Crown size={12} className="text-[var(--color-primary)] shrink-0" />}
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
              {showTyping ? (
                <><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" /> typing…</>
              ) : (
                <><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {isAI ? "AI · 24/7" : "Secure Session"}</>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Rate chip */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, delay: 0.2 }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-black shrink-0",
              liveRate > 0
                ? "bg-gradient-to-r from-[var(--color-primary)]/10 to-violet-500/10 border-[var(--color-primary)]/30 text-[var(--color-primary)]"
                : "bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/25 text-emerald-400",
            )}
          >
            <Coins size={12} />
            {liveRate > 0 ? `₹${liveRate}/min` : "Free"}
          </motion.div>

          {/* Delete button */}
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-xl hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-all active:scale-95"
            aria-label="Delete conversation"
            title="Delete conversation"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </motion.div>

      {/* Reconnecting strip */}
      <AnimatePresence>
        {!isAI && connection !== "connected" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-none px-3 md:px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/25 text-amber-500 text-[11px] font-bold flex items-center gap-2"
          >
            <WifiOff size={12} /> Reconnecting — messages may arrive with a short delay.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Billing panel */}
      <AnimatePresence>
        {sessionId && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <BillingPanel
              key={sessionId}
              sessionId={sessionId}
              rate={liveRate}
              onEnd={handleSessionEnd}
              onTerminated={(reason) => { setTerminationReason(reason); setSessionId(null); }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Termination banner */}
      <AnimatePresence>
        {terminationReason && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-none px-3 md:px-4 py-2 bg-rose-500/10 border-b border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2"
          >
            <AlertTriangle size={12} /> {terminationReason}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 md:px-4 py-4 space-y-4 custom-scrollbar relative z-10"
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        {/* Encrypted session badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center pb-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[var(--color-primary)]/10 via-violet-500/10 to-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs font-bold rounded-full mb-2 backdrop-blur-xl">
            <ShieldCheck size={14} /> Encrypted Session
          </div>
          <p className="text-muted-foreground text-[11px]">
            {isAI ? "AI consultant is ready — go ahead and ask." : "Your session has started."}
          </p>
        </motion.div>

        {/* Kundali chart */}
        <AnimatePresence>
          {kundaliChart && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="py-2"
            >
              <ChatKundaliChart
                data={kundaliChart}
                seekerName={seekerName}
                onClose={() => setKundaliChart(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Birth info bars */}
        <AnimatePresence>
          {birthInfo && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-3 gap-2 py-2"
            >
              {birthInfo.dob && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-sunken/80 border border-border/50 backdrop-blur-xl"
                >
                  <Calendar size={12} className="text-[var(--color-primary)]" />
                  <div className="min-w-0">
                    <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Born</p>
                    <p className="text-[11px] font-bold text-foreground truncate">{birthInfo.dob}</p>
                  </div>
                </motion.div>
              )}
              {birthInfo.tob && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-sunken/80 border border-border/50 backdrop-blur-xl"
                >
                  <Timer size={12} className="text-violet-400" />
                  <div className="min-w-0">
                    <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Time</p>
                    <p className="text-[11px] font-bold text-foreground truncate">{birthInfo.tob}</p>
                  </div>
                </motion.div>
              )}
              {birthInfo.pob && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-sunken/80 border border-border/50 backdrop-blur-xl"
                >
                  <MapPin size={12} className="text-amber-400" />
                  <div className="min-w-0">
                    <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Place</p>
                    <p className="text-[11px] font-bold text-foreground truncate">{birthInfo.pob}</p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Load older */}
        {!isAI && hasMore && messages.length > 0 && (
          <div className="flex justify-center pb-1">
            <button
              type="button"
              onClick={() => void handleLoadOlder()}
              disabled={isLoadingOlder}
              className="px-3 py-1.5 rounded-full text-[11px] font-bold glass-luxury text-muted-foreground hover:text-foreground flex items-center gap-1.5 disabled:opacity-60 transition-all"
            >
              {isLoadingOlder
                ? <Loader2 size={12} className="animate-spin" />
                : <ChevronUp size={12} />}
              Load earlier messages
            </button>
          </div>
        )}

        {isLoading && messages.length === 0 ? (
          <BrandLoader variant="chat-bubble" label="Opening the reading room…" />
        ) : messages.length === 0 ? (
          <ChatWelcomeSuggestions isAI={isAI} />
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg: ChatMessage, idx: number) => {
              const isMe = msg.senderId === currentUserId;
              const prev = idx > 0 ? messages[idx - 1] : null;
              const newDay = !prev
                || new Date(prev.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
              return (
                <div key={msg.id}>
                  {newDay && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-center pb-1"
                    >
                      <span className="px-3 py-1 rounded-full bg-surface-sunken border border-border text-[10px] font-bold text-muted-foreground">
                        {dayLabel(msg.createdAt)}
                      </span>
                    </motion.div>
                  )}
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: isMe ? 35 : 30,
                      delay: idx * 0.03,
                    }}
                    className={cn("flex flex-col group", isMe ? "items-end" : "items-start")}
                  >
                    <div className={cn(
                      "max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words relative",
                      "[&>*]:max-w-[65ch]",
                      isMe
                        ? "bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white rounded-br-sm shadow-lg shadow-[var(--color-primary)]/20"
                        : "bg-surface-sunken/90 text-foreground border border-border/50 rounded-bl-sm backdrop-blur-xl",
                      !isMe && isAI && "shadow-md shadow-[var(--color-primary)]/5",
                      msg._optimistic && "opacity-85 saturate-75"
                    )}>
                      <MessageContent content={msg.content} />
                    </div>
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1 px-1 font-medium">
                      {isMe && msg._optimistic && <PendingDot />}
                      {formatTime(msg.createdAt)}
                      {isMe && msg._optimistic && <span className="opacity-70">sending…</span>}
                      {isMe && !msg._optimistic && isSeen && msg.id === lastMine?.id && (
                        <CheckCheck size={12} className="text-sky-400" />
                      )}
                      {!isMe && isAI && (
                        <span className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => console.log("Thumbs up:", msg.id)}
                            className="p-0.5 rounded hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-400 transition-colors"
                            aria-label="Helpful response"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M7 10v12" />
                              <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => console.log("Thumbs down:", msg.id)}
                            className="p-0.5 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-colors"
                            aria-label="Not helpful"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 14V2" />
                              <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 1-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
                            </svg>
                          </button>
                        </span>
                      )}
                    </span>
                  </motion.div>
                </div>
              );
            })}
          </AnimatePresence>
        )}

        {/* Streaming */}
        {showStreaming && (
          <div className="flex flex-col items-start">
            {streamingStage && !streamingText && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-[80%] mb-1.5 px-3 py-1.5 rounded-full bg-[var(--color-primary)]/8 border border-[var(--color-primary)]/20 flex items-center gap-2 text-[11px] font-semibold text-[var(--color-primary)] backdrop-blur-xl"
              >
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inset-0 rounded-full bg-[var(--color-primary)] animate-ping opacity-70" />
                  <span className="relative rounded-full w-1.5 h-1.5 bg-[var(--color-primary)]" />
                </span>
                <span className="truncate">{streamingStage.label}</span>
                <span className="text-[var(--color-primary)]/60 tabular-nums shrink-0">
                  {streamingStage.index + 1}/{streamingStage.total}
                </span>
              </motion.div>
            )}
            {completedStages.length > 0 && !streamingText && !streamingStage && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-[80%] mb-1.5 px-3 py-1.5 rounded-full bg-emerald-500/8 border border-emerald-500/20 flex items-center gap-2 text-[11px] font-semibold text-emerald-400 backdrop-blur-xl"
              >
                <Sparkles size={11} className="shrink-0" />
                <span>Composing your reading…</span>
              </motion.div>
            )}
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={cn(
                "max-w-[80%] px-4 py-2.5 rounded-2xl rounded-bl-sm bg-surface-sunken/90 text-foreground border border-border/50 text-sm leading-relaxed relative backdrop-blur-xl",
                "[&>*]:max-w-[65ch]",
                streamingStage && !streamingText && "opacity-60",
              )}
            >
              {streamDisplay ? (
                <>
                  {!streamingText && fillerText && (
                    <span className="italic text-muted-foreground">{streamDisplay}</span>
                  )}
                  {streamingText && <MessageContent content={streamingText} />}
                </>
              ) : !streamingStage ? (
                <StreamingIndicator />
              ) : (
                <span className="italic text-muted-foreground">Thinking…</span>
              )}
              {streamingText && (
                <span className="inline-block w-0.5 h-4 ml-0.5 bg-[var(--color-primary)] align-middle animate-cursor-blink" />
              )}
              {streamingText && (
                <button
                  type="button"
                  onClick={() => {
                    setStreamingText(null);
                    setFillerText(null);
                    setStreamingStage(null);
                  }}
                  className="absolute -bottom-3 right-2 px-2.5 py-1 rounded-full bg-surface border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground hover:border-[var(--color-primary)]/40 transition-all active:scale-95 flex items-center gap-1"
                  aria-label="Stop generating"
                >
                  <span className="w-1.5 h-1.5 rounded-sm bg-current" />
                  Stop
                </button>
              )}
            </motion.div>
          </div>
        )}

        {/* Suggestions */}
        {isAI && !showStreaming && suggestions.length > 0 && messages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-start gap-2 pt-1"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
              Ask next
            </span>
            <div className="flex flex-wrap gap-2 max-w-[85%]">
              {suggestions.map((s, i) => (
                <motion.button
                  key={`${s.label}-${i}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  type="button"
                  onClick={() => void deliver(s.prompt, "")}
                  disabled={isSending || inFlightRef.current}
                  className={cn(
                    "group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold",
                    "bg-surface border border-border text-foreground",
                    "hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 hover:text-[var(--color-primary)]",
                    "active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-wait",
                  )}
                  title={s.prompt}
                >
                  <SuggestionIcon name={s.icon} />
                  <span>{s.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Typing indicator */}
        {showTyping && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="flex items-center gap-2 px-4 py-3 bg-surface-sunken/90 border border-border/50 rounded-2xl rounded-bl-sm w-max shadow-sm backdrop-blur-xl"
          >
            <span className="text-[10px] font-bold text-muted-foreground">{partnerName}</span>
            <span className="flex gap-1 items-center">
              <motion.span
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full"
              />
              <motion.span
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
                className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full"
              />
              <motion.span
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full"
              />
            </span>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex-none p-3 md:p-4 bg-surface/80 backdrop-blur-3xl border-t border-border/50 transition-[padding] duration-150 relative z-10"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px + var(--kb-offset, 0px))" }}
      >
        {/* Send error */}
        <AnimatePresence>
          {sendError && (
            <motion.div
              initial={{ opacity: 0, y: 8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              className="max-w-4xl mx-auto mb-2"
            >
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-bold">
                <AlertTriangle size={12} className="shrink-0" />
                <span className="flex-1">{sendError}</span>
                {failedText && (
                  <button
                    type="button"
                    onClick={() => void deliver(failedText, "")}
                    disabled={isSending || uploading}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 transition-colors disabled:opacity-50 disabled:cursor-wait"
                  >
                    Retry
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSendError(null)}
                  className="p-0.5 rounded-full hover:bg-rose-500/20 transition-colors"
                  aria-label="Dismiss"
                >
                  <X size={12} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick replies */}
        {isAI && messages.length === 0 && (
          <div className="max-w-4xl mx-auto mb-3 flex flex-wrap gap-2">
            {AI_QUICK_REPLIES.map((q, i) => (
              <motion.button
                key={q}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                type="button"
                onClick={() => { setInput(q); }}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold glass-luxury text-muted-foreground hover:text-foreground hover:border-[var(--color-luxury-gold)]/30 transition-all active:scale-[0.97]"
              >
                <Sparkles size={10} className="inline mr-1" />{q}
              </motion.button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 px-1">
              {attachments.map((file, idx) => (
                <motion.div
                  key={`${file.name}-${idx}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative group flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-sunken border border-border text-xs"
                >
                  {file.type.startsWith("image/") && previewUrls[idx] ? (
                    <img
                      src={previewUrls[idx]}
                      alt={file.name}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
                      <Paperclip size={14} className="text-[var(--color-primary)]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-foreground font-bold truncate max-w-[120px]">{file.name}</p>
                    <p className="text-muted-foreground text-[10px]">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="p-0.5 rounded-full hover:bg-border/60 transition-colors"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={12} className="text-muted-foreground" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 md:gap-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt"
              onChange={handleFileSelect}
              className="hidden"
              aria-label="Upload file"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={attachments.length >= 5 || uploading}
              aria-label="Attach a file or photo"
              title={attachments.length >= 5 ? "Too many files — remove some first" : "Send an image or file for analysis"}
              className={cn(
                "w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center shrink-0 transition-all",
                attachments.length >= 5 || uploading
                  ? "bg-surface-sunken text-muted-foreground/50 cursor-not-allowed"
                  : "bg-surface border border-border text-muted-foreground hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 active:scale-95"
              )}
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
            </button>
            <textarea
              value={input}
              onChange={handleChange}
              onBlur={() => !isAI && setTyping(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }}
              placeholder={isAI ? `Write a message to ${partnerName}…` : "Type your message…"}
              aria-label={`Message ${partnerName}`}
              maxLength={4000}
              rows={1}
              className="flex-1 bg-surface border border-border rounded-3xl px-5 py-3 text-sm focus:outline-none focus:border-[var(--color-primary)] text-foreground shadow-inner placeholder:text-muted-foreground resize-none overflow-hidden min-h-[48px] max-h-[120px] leading-snug transition-all"
              style={{ height: "auto" }}
              ref={(el) => {
                if (el) {
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 120) + "px";
                }
              }}
            />
            <button
              type="submit"
              disabled={(!input.trim() && attachments.length === 0) || isSending || showStreaming || uploading}
              aria-label="Send message"
              className={cn(
                "w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all shrink-0",
                (input.trim() || attachments.length > 0) && !isSending && !showStreaming && !uploading
                  ? "bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white shadow-[0_0_20px_rgba(157,125,197,0.4)] active:scale-95"
                  : "bg-surface-sunken text-muted-foreground cursor-not-allowed"
              )}
            >
              {isSending || uploading ? <BrandLoader variant="inline" /> : <Send size={18} className="ml-0.5" />}
            </button>
          </div>
        </form>
      </motion.div>

      <WalletGateDialog
        open={walletGate !== null}
        onOpenChange={(open) => { if (!open) setWalletGate(null); }}
        info={walletGate}
        resume={false}
      />

      {isAI && intake.open && (
        <BirthIntakeModal
          open
          onOpenChange={() => {}}
          consultantName={partnerName}
          existingProfile={intake.prefill}
          onSubmit={intake.submit}
          isLoading={intake.saving}
          error={intake.error}
          actionLabel="Save and begin reading"
        />
      )}

      {isAI && intake.transitioning && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
          <BrandLoader variant="chat-bubble" label="Preparing your reading room…" />
        </div>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Conversation"
        description="This will permanently delete this conversation and all messages. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleDeleteConversation}
        loading={deleting}
      />
    </div>
  );
}
