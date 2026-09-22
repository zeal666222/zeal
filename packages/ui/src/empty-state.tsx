"use client";
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./utils";

interface EmptyStateProps {
  icon?: LucideIcon | string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
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
      {icon !== undefined && icon !== null && (
        typeof icon === "string" ? (
          <div className="text-4xl mb-4" aria-hidden>{icon}</div>
        ) : (
          <div className="p-4 rounded-full bg-[var(--color-surface-raised)] mb-4">
            {React.createElement(icon, {
              className: "w-8 h-8 text-[var(--color-muted-foreground)]",
            })}
          </div>
        )
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
