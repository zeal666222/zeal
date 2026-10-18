"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// BrandLoader — the canonical loading surface
// ═══════════════════════════════════════════════════════════════════════════════
// Every loading.tsx, submit button, and pending bubble funnels through here so
// the user always sees the same animated Z mark in the same choreography.
// Variants: default (bare mark), page (route loading.tsx), chat-bubble
// (optimistic user msg + streaming AI), cards (Explore/Astrologers grid),
// inline (button-spinner sized to text).
// ═══════════════════════════════════════════════════════════════════════════════

import type { CSSProperties, ReactNode } from "react";
import { cn } from "../utils";
import { ZealMark } from "./zeal-mark";

export type BrandLoaderVariant =
  | "default"
  | "page"
  | "chat-bubble"
  | "cards"
  | "profile"
  | "inline";

export interface BrandLoaderProps {
  variant?: BrandLoaderVariant;
  /** Optional label under the mark (defaults to localized "Loading…"). */
  label?: string;
  /** Cards count when variant="cards". */
  count?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

function Shell({
  size = 46,
  label,
  children,
  className,
  style,
  dense = false,
}: {
  size?: number;
  label?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  dense?: boolean;
}) {
  return (
    <div
      className={cn("brand-loader", dense ? "brand-loader--dense" : "brand-loader--stack", className)}
      style={style}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="brand-loader__mark" style={{ width: size, height: size }}>
        <ZealMark size={size} draw glow />
      </div>
      {label && <div className="brand-loader__label">{label}</div>}
      {children}
    </div>
  );
}

function Cards({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="brand-skel brand-skel--card"
          style={{ animationDelay: `${(i % 6) * 90}ms` }}
        />
      ))}
    </>
  );
}

function Bubbles() {
  return (
    <div className="brand-loader__bubbles">
      <div className="brand-skel brand-skel--bubble brand-skel--bubble-right" />
      <div className="brand-skel brand-skel--bubble brand-skel--bubble-left" />
      <div className="brand-skel brand-skel--bubble brand-skel--bubble-right" />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="brand-loader__profile">
      <div className="brand-skel brand-skel--avatar" />
      <div className="brand-loader__profile-lines">
        <div className="brand-skel brand-skel--line" style={{ width: "45%" }} />
        <div className="brand-skel brand-skel--line" style={{ width: "70%" }} />
        <div className="brand-skel brand-skel--line" style={{ width: "55%" }} />
      </div>
    </div>
  );
}

export function BrandLoader({
  variant = "default",
  label,
  count = 6,
  className,
  style,
}: BrandLoaderProps) {
  if (variant === "inline") {
    return (
      <span className={cn("brand-loader brand-loader--inline", className)} style={style} aria-busy="true">
        <ZealMark size={16} detail="micro" draw={false} glow={false} />
      </span>
    );
  }

  if (variant === "cards") {
    return (
      <div
        className={cn("brand-loader brand-loader--page", className)}
        style={style}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Shell size={54} label={label ?? "Summoning the cosmos…"} />
        <div className="brand-loader__grid">
          <Cards count={count} />
        </div>
      </div>
    );
  }

  if (variant === "chat-bubble") {
    return (
      <div
        className={cn("brand-loader brand-loader--page", className)}
        style={style}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Shell size={54} label={label ?? "Opening the reading room…"} />
        <Bubbles />
      </div>
    );
  }

  if (variant === "profile") {
    return (
      <div
        className={cn("brand-loader brand-loader--page", className)}
        style={style}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Shell size={54} label={label} />
        <ProfileSkeleton />
      </div>
    );
  }

  if (variant === "page") {
    return (
      <div
        className={cn("brand-loader brand-loader--page", className)}
        style={style}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Shell size={60} label={label ?? "Loading…"} />
      </div>
    );
  }

  return <Shell size={44} label={label} className={className} style={style} dense />;
}

/**
 * PendingDot — the tiny mark that lives inside an optimistic chat bubble
 * while the POST/SSE handshake is in flight.
 */
export function PendingDot({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span
      className={cn("brand-pending-dot", className)}
      style={style}
      aria-label="Sending"
      role="status"
    >
      <ZealMark size={12} detail="micro" draw={false} glow={false} />
    </span>
  );
}

/**
 * StreamingIndicator — appears at the head of an AI bubble until the first
 * token arrives.
 */
export function StreamingIndicator({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span
      className={cn("brand-streaming", className)}
      style={style}
      role="status"
      aria-live="polite"
    >
      <ZealMark size={18} detail="micro" draw glow />
      <span className="brand-streaming__dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
    </span>
  );
}

/**
 * BrandSpinner — drop-in replacement for a `<Loader2 className="animate-spin" />`
 * button state. Micro-detail mark, breathes at the same tempo as the pending dot.
 */
export function BrandSpinner({
  size = 18,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn("brand-pending-dot", className)}
      style={{ width: size, height: size, ...style }}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <ZealMark size={size} detail="micro" draw={false} glow={false} />
    </span>
  );
}
