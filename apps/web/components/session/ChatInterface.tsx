"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// ChatInterface — Ultra-premium astrology chat with DG-beating design
// Features: Birth card, info cards, moon phase, chart toggles, premium bubbles
// ═══════════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, ArrowLeft, CheckCheck, ChevronUp, Coins, Heart, Home,
  Loader2, MessageCircle, Moon, Paperclip, Send, ShieldCheck, Sparkles,
  Briefcase, Clock, BarChart3, WifiOff, X, Trash2, MapPin, Calendar,
  Timer, Star, Zap, Crown, Sun, Sunrise,
} from "lucide-react";
import Image from "next/image";
import { useChat, type BillingInfo, type ChatMessage, type StageEvent, type Suggestion } from "@/hooks/useChat";
import { useTyping } from "@/hooks/useTyping";
import { useConnection } from "@zeal/realtime";
import { BillingPanel } from "./BillingPanel";
import { WalletGateDialog, type WalletGateInfo } from "@/components/billing/WalletGateDialog";
import { BirthIntakeModal } from "@/components/chat/BirthIntakeModal";
import { useRoomIntake } from "@/lib/chat/use-room-intake";
import { cn, BrandLoader, PendingDot, StreamingIndicator, ConfirmDialog } from "@zeal/ui";
import { ChatWelcomeSuggestions } from "./ChatWelcomeSuggestions";
import { ChatKundaliChart, type ChatKundaliData } from "@/components/astrology/ChatKundaliChart";
import { computeKundali } from "@/lib/kundali/engine";

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

// Moon phase calculation (simplified)
function getMoonPhase(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  let c = 0, e = 0, jd = 0, b = 0;
  if (month < 3) {
    c = year - 1;
    e = month + 12;
  } else {
    c = year;
    e = month;
  }
  jd = (365.25 * (c + 4716)) + (30.6001 * (e + 1)) + day - 1524.5;
  const daysSinceNew = jd - 2451549.5;
  const newMoons = daysSinceNew / 29.53058867;
  const phase = (newMoons - Math.floor(newMoons)) * 29.53058867;
  return phase;
}

function MoonPhaseBar({ date }: { date: Date }) {
  const phase = getMoonPhase(date);
  const phasePercent = (phase / 29.53) * 100;
  const isWaxing = phase < 14.77;
  
  return (
    <div className="relative h-10 rounded-full bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 overflow-hidden border border-purple-500/20">
      {/* Stars */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.1 }}
            className="absolute w-0.5 h-0.5 bg-white rounded-full"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 23) % 100}%`,
            }}
          />
        ))}
      </div>
      {/* Moon position */}
      <motion.div
        initial={{ left: 0 }}
        animate={{ left: `${phasePercent}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="absolute top-1/2 -translate-y-1/2"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-amber-200 rounded-full blur-md" />
          <Moon size={20} className="text-amber-100 relative z-10" fill="currentColor" />
        </div>
      </motion.div>
      {/* Phase label */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-purple-200">
        {isWaxing ? "Waxing" : "Waning"}
      </div>
    </div>
  );
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
  const [chartType, setChartType] = useState<"D1" | "D9">("D1");
  const [showAllCharts, setShowAllCharts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const prevHeightRef = useRef(0);
  const inFlightRef = useRef(false);
  const openerFiredRef = useRef(false);
  const [kundaliChart, setKundaliChart] = useState<ChatKundaliData | null>(null);
  const [seekerName, setSeekerName] = useState<string | undefined>();
  const [birthInfo, setBirthInfo] = useState<{ dob?: string; tob?: string; pob?: string; name?: string } | null>(null);
  const [moonSign, setMoonSign] = useState<string>("");
  const [nakshatra, setNakshatra] = useState<string>("");
  const [lagna, setLagna] = useState<string>("");

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

  // AI chat: fetch birth profile and compute kundali chart + info cards
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
          name: profile.fullName,
          dob: profile.dateOfBirth,
          tob: profile.timeOfBirth ?? undefined,
          pob: profile.placeOfBirth,
        });
        setLagna(result.chart.ascendantSign);
        setNakshatra(result.panchanga.nakshatra);
        // Find moon sign from planets
        const moon = result.chart.planets.find((p) => p.planet === "Moon");
        if (moon) setMoonSign(moon.sign);
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
          setBirthInfo({ name: birth.name, dob: birth.dob, tob: birth.tob, pob: birth.pob });
          setLagna(result.chart.ascendantSign);
          setNakshatra(result.panchanga.nakshatra);
          const moon = result.chart.planets.find((p) => p.planet === "Moon");
          if (moon) setMoonSign(moon.sign);
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
      // Navigate to chat home to trigger sidebar refresh
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
    <div className="flex flex-col h-full bg-gradient-to-b from-[#0a0a0f] via-[#0f0f1a] to-[#0a0a0f] relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.15, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"
        />
      </div>

      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="flex-none h-16 bg-[#0f0f1a]/90 backdrop-blur-2xl border-b border-amber-500/10 px-3 md:px-4 flex items-center justify-between z-20 relative"
      >
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Link
            href="/"
            aria-label="Home"
            className="shrink-0 p-2 rounded-xl hover:bg-white/5 text-amber-100/70 hover:text-amber-100 transition-all"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="relative">
            <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-amber-400/20 to-purple-500/20 flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-amber-400/30">
              {partnerAvatar ? (
                <Image src={partnerAvatar} alt={partnerName} fill sizes="48px" className="object-cover" />
              ) : (
                <span className="text-lg font-bold text-amber-100">{partnerName.charAt(0).toUpperCase()}</span>
              )}
              {isAI && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-amber-400 to-purple-500 flex items-center justify-center"
                >
                  <Sparkles size={9} className="text-white" />
                </motion.div>
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-[#0f0f1a]" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-amber-100 text-sm flex items-center gap-2 truncate">
              Chat with {partnerName}
              {isAI && <Crown size={12} className="text-amber-400 shrink-0" />}
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {isAI ? "AI · 24/7" : "Online"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-xl hover:bg-rose-500/10 text-amber-100/50 hover:text-rose-400 transition-all"
            aria-label="Delete conversation"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </motion.div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 md:px-4 py-4 space-y-4 custom-scrollbar relative z-10"
        role="log"
        aria-live="polite"
      >
        {/* Birth Details Card */}
        {birthInfo && isAI && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl bg-gradient-to-br from-[#1a1a2e] to-[#16162a] border border-amber-500/20 p-4 mb-4"
          >
            {/* 2x2 Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {birthInfo.name && (
                <div>
                  <p className="text-[10px] text-amber-100/50 font-semibold uppercase tracking-wider mb-1">Name</p>
                  <p className="text-sm font-bold text-amber-100">{birthInfo.name}</p>
                </div>
              )}
              {birthInfo.dob && (
                <div>
                  <p className="text-[10px] text-amber-100/50 font-semibold uppercase tracking-wider mb-1">Birth Date</p>
                  <p className="text-sm font-bold text-amber-100">{new Date(birthInfo.dob).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                </div>
              )}
              {birthInfo.tob && (
                <div>
                  <p className="text-[10px] text-amber-100/50 font-semibold uppercase tracking-wider mb-1">Birth Time</p>
                  <p className="text-sm font-bold text-amber-100">{birthInfo.tob}</p>
                </div>
              )}
              {birthInfo.pob && (
                <div>
                  <p className="text-[10px] text-amber-100/50 font-semibold uppercase tracking-wider mb-1">Birth Place</p>
                  <p className="text-sm font-bold text-amber-100">{birthInfo.pob}</p>
                </div>
              )}
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {lagna && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 }}
                  className="rounded-xl bg-gradient-to-br from-purple-900/40 to-purple-950/60 border border-purple-500/30 px-3 py-2 text-center"
                >
                  <p className="text-[9px] text-purple-200/70 font-semibold uppercase tracking-wider">Lagan</p>
                  <p className="text-sm font-bold text-purple-100 mt-0.5">{lagna}</p>
                </motion.div>
              )}
              {moonSign && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                  className="rounded-xl bg-gradient-to-br from-amber-900/40 to-amber-950/60 border border-amber-500/30 px-3 py-2 text-center"
                >
                  <p className="text-[9px] text-amber-200/70 font-semibold uppercase tracking-wider">Moon Sign</p>
                  <p className="text-sm font-bold text-amber-100 mt-0.5">{moonSign}</p>
                </motion.div>
              )}
              {nakshatra && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 }}
                  className="rounded-xl bg-gradient-to-br from-teal-900/40 to-teal-950/60 border border-teal-500/30 px-3 py-2 text-center"
                >
                  <p className="text-[9px] text-teal-200/70 font-semibold uppercase tracking-wider">Nakshatra</p>
                  <p className="text-sm font-bold text-teal-100 mt-0.5">{nakshatra}</p>
                </motion.div>
              )}
            </div>

            {/* Moon Phase Bar */}
            <MoonPhaseBar date={new Date()} />

            {/* Chart Type Toggle */}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setChartType("D1")}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                  chartType === "D1"
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/25"
                    : "bg-white/5 text-amber-100/70 border border-amber-500/20 hover:bg-white/10"
                )}
              >
                Ascendant (D1)
              </button>
              <button
                type="button"
                onClick={() => setChartType("D9")}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                  chartType === "D9"
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/25"
                    : "bg-white/5 text-amber-100/70 border border-amber-500/20 hover:bg-white/10"
                )}
              >
                Navamsha (D9)
              </button>
            </div>

            {/* Kundali Chart */}
            {kundaliChart && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="mt-4"
              >
                <p className="text-center text-xs font-bold text-amber-100/70 mb-2">
                  {chartType === "D1" ? "Ascendant Chart (D1)" : "Navamsha Chart (D9)"}
                </p>
                <ChatKundaliChart
                  data={kundaliChart}
                  seekerName={seekerName}
                />
              </motion.div>
            )}

            {/* Show All Charts Button */}
            <button
              type="button"
              onClick={() => setShowAllCharts(!showAllCharts)}
              className="w-full mt-4 py-2.5 rounded-xl bg-white/5 border border-amber-500/20 text-amber-100/90 text-xs font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <BarChart3 size={14} />
              {showAllCharts ? "Hide Charts" : "Show All Charts"}
            </button>
          </motion.div>
        )}

        {/* Messages */}
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
                      <span className="px-3 py-1 rounded-full bg-white/5 border border-amber-500/10 text-[10px] font-bold text-amber-100/50">
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
                    className={cn("flex gap-2", isMe ? "flex-row-reverse" : "flex-row")}
                  >
                    {/* Avatar */}
                    {!isMe && (
                      <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-amber-400/20 to-purple-500/20 flex items-center justify-center ring-1 ring-amber-400/30">
                        {partnerAvatar ? (
                          <Image src={partnerAvatar} alt={partnerName} width={32} height={32} className="rounded-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-amber-100">{partnerName.charAt(0)}</span>
                        )}
                      </div>
                    )}
                    <div className={cn("flex flex-col max-w-[75%]", isMe ? "items-end" : "items-start")}>
                      <div className={cn(
                        "px-4 py-3 rounded-2xl text-sm leading-relaxed break-words",
                        isMe
                          ? "bg-gradient-to-br from-amber-100 to-amber-50 text-[#1a1a2e] rounded-br-sm shadow-lg shadow-amber-500/10"
                          : "bg-[#1a1a2e] text-amber-50 border border-amber-500/10 rounded-bl-sm"
                      )}>
                        <MessageContent content={msg.content} />
                      </div>
                      <span className="flex items-center gap-1.5 text-[10px] text-amber-100/40 mt-1 px-1">
                        {isMe && msg._optimistic && <PendingDot />}
                        {formatTime(msg.createdAt)}
                        {isMe && msg._optimistic && <span className="opacity-70">sending…</span>}
                        {isMe && !msg._optimistic && isSeen && msg.id === lastMine?.id && (
                          <CheckCheck size={12} className="text-sky-400" />
                        )}
                      </span>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </AnimatePresence>
        )}

        {/* Streaming */}
        {showStreaming && (
          <div className="flex gap-2">
            <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-amber-400/20 to-purple-500/20 flex items-center justify-center ring-1 ring-amber-400/30">
              {partnerAvatar ? (
                <Image src={partnerAvatar} alt={partnerName} width={32} height={32} className="rounded-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-amber-100">{partnerName.charAt(0)}</span>
              )}
            </div>
            <div className="flex flex-col items-start max-w-[75%]">
              {streamingStage && !streamingText && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-[11px] font-semibold text-amber-200"
                >
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-70" />
                    <span className="relative rounded-full w-1.5 h-1.5 bg-amber-400" />
                  </span>
                  <span className="truncate">{streamingStage.label}</span>
                </motion.div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="px-4 py-3 rounded-2xl rounded-bl-sm bg-[#1a1a2e] text-amber-50 border border-amber-500/10 text-sm leading-relaxed"
              >
                {streamDisplay ? (
                  <>
                    {!streamingText && fillerText && (
                      <span className="italic text-amber-100/50">{streamDisplay}</span>
                    )}
                    {streamingText && <MessageContent content={streamingText} />}
                  </>
                ) : !streamingStage ? (
                  <StreamingIndicator />
                ) : (
                  <span className="italic text-amber-100/50">Thinking…</span>
                )}
                {streamingText && (
                  <span className="inline-block w-0.5 h-4 ml-0.5 bg-amber-400 align-middle animate-cursor-blink" />
                )}
              </motion.div>
            </div>
          </div>
        )}

        {/* Suggestions */}
        {isAI && !showStreaming && suggestions.length > 0 && messages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-start gap-2 pt-1"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-100/50 px-1">
              Ask next
            </span>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <motion.button
                  key={`${s.label}-${i}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  type="button"
                  onClick={() => void deliver(s.prompt, "")}
                  disabled={isSending || inFlightRef.current}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-white/5 border border-amber-500/20 text-amber-100 hover:bg-white/10 hover:border-amber-500/40 transition-all disabled:opacity-50"
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
            className="flex items-center gap-2 px-4 py-3 bg-[#1a1a2e] border border-amber-500/10 rounded-2xl rounded-bl-sm w-max"
          >
            <span className="text-[10px] font-bold text-amber-100/50">{partnerName}</span>
            <span className="flex gap-1 items-center">
              <motion.span
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                className="w-1.5 h-1.5 bg-amber-400 rounded-full"
              />
              <motion.span
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
                className="w-1.5 h-1.5 bg-amber-400 rounded-full"
              />
              <motion.span
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                className="w-1.5 h-1.5 bg-amber-400 rounded-full"
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
        className="flex-none p-3 md:p-4 bg-[#0f0f1a]/90 backdrop-blur-3xl border-t border-amber-500/10 relative z-10"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px + var(--kb-offset, 0px))" }}
      >
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <textarea
              value={input}
              onChange={handleChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }}
              placeholder={`Ask ${partnerName} about astrology...`}
              maxLength={4000}
              rows={1}
              className="flex-1 bg-white/5 border border-amber-500/20 rounded-2xl px-4 py-3 text-sm text-amber-50 placeholder:text-amber-100/30 resize-none overflow-hidden min-h-[48px] max-h-[120px] leading-snug focus:outline-none focus:border-amber-500/40 transition-all"
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
              disabled={!input.trim() || isSending || showStreaming}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
            >
              {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
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
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#0a0a0f]/90 backdrop-blur-sm">
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
