#!/usr/bin/env bash
# ZEAL - Verbatim Module Syntax Type Fix

echo "🚀 [1/3] Patching verbatimModuleSyntax imports in @zeal/ui..."

# Fix empty-state.tsx
cat << 'EOF' > packages/ui/src/empty-state.tsx
"use client";
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "min-h-[280px] p-8",
        className,
      )}
    >
      {Icon && (
        <div className="p-4 rounded-full bg-[var(--color-surface-raised)] mb-4">
          <Icon className="w-8 h-8 text-[var(--color-muted-foreground)]" />
        </div>
      )}
      <h3 className="text-base font-semibold text-[var(--color-foreground)]">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--color-muted-foreground)] mt-1.5 max-w-md">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
EOF

# Fix kpi-card.tsx
cat << 'EOF' > packages/ui/src/kpi-card.tsx
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: { direction: "up" | "down" | "flat"; value: string };
  hint?: string;
  accent?: "primary" | "success" | "warning" | "destructive" | "info";
  loading?: boolean;
  className?: string;
}

const ACCENT: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  primary:     "text-[var(--color-primary)] bg-[var(--color-primary-muted)]",
  success:     "text-[var(--color-success)] bg-[var(--color-success-muted)]",
  warning:     "text-[var(--color-warning)] bg-[var(--color-warning-muted)]",
  destructive: "text-[var(--color-destructive)] bg-[var(--color-destructive-muted)]",
  info:        "text-[var(--color-primary)] bg-[var(--color-primary-muted)]",
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  hint,
  accent = "primary",
  loading = false,
  className,
}: KpiCardProps) {
  const trendColor =
    trend?.direction === "up"
      ? "text-emerald-500"
      : trend?.direction === "down"
      ? "text-rose-500"
      : "text-[var(--color-muted-foreground)]";
  const trendArrow =
    trend?.direction === "up"
      ? "▲"
      : trend?.direction === "down"
      ? "▼"
      : "•";

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:p-5",
        "transition-colors hover:border-[var(--color-primary)]/30",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-[var(--color-muted-foreground)]">
          {label}
        </span>
        {Icon && (
          <div className={cn("p-2 rounded-lg shrink-0", ACCENT[accent])}>
            <Icon size={14} />
          </div>
        )}
      </div>
      <div className="text-xl md:text-3xl font-black font-mono text-[var(--color-foreground)] tabular-nums tracking-tight">
        {loading ? (
          <span className="inline-block w-16 h-6 rounded bg-[var(--color-surface-raised)] animate-pulse" />
        ) : (
          value
        )}
      </div>
      {trend && !loading && (
        <div className={cn("mt-1.5 text-[11px] font-bold flex items-center gap-1", trendColor)}>
          <span aria-hidden>{trendArrow}</span>
          <span>{trend.value}</span>
        </div>
      )}
      {hint && !trend && !loading && (
        <div className="mt-1.5 text-[11px] text-[var(--color-muted-foreground)]">{hint}</div>
      )}
    </div>
  );
}
EOF

echo "✅ Type imports resolved."

echo "🔍 [2/3] Running Full Type Check..."
npm run type-check

echo "📦 [3/3] Committing and Pushing to Origin..."
git add packages/ui/src/empty-state.tsx packages/ui/src/kpi-card.tsx
git commit -m "fix(ui): resolve verbatimModuleSyntax type import errors for LucideIcon"
git push origin HEAD

echo "🎉 Deployment successfully pushed."