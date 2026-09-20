import * as React from "react";
import { cn } from "./utils";

interface Props {
  direction: "up" | "down" | "flat";
  value: string;
  label?: string;
  className?: string;
}

export function TrendBadge({ direction, value, label, className }: Props) {
  const color =
    direction === "up" ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
    : direction === "down" ? "text-rose-500 bg-rose-500/10 border-rose-500/20"
    : "text-[var(--color-muted-foreground)] bg-[var(--color-surface-raised)] border-[var(--color-border)]";
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "•";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider",
        color,
        className,
      )}
      aria-label={label ? `${label}: ${direction} ${value}` : `${direction} ${value}`}
    >
      <span aria-hidden>{arrow}</span>
      <span>{value}</span>
    </span>
  );
}
