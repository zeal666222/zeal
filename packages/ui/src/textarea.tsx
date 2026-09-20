import * as React from "react";
import { cn } from "./utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <div className="space-y-1.5">
      <textarea
        ref={ref}
        className={cn(
          "w-full min-h-24 rounded-xl px-4 py-3 text-sm resize-none",
          "bg-[var(--color-surface)] text-[var(--color-foreground)]",
          "border border-[var(--color-border)]",
          "placeholder:text-[var(--color-subtle-foreground)]",
          "focus:outline-none focus:border-[var(--color-primary)]",
          "focus:ring-2 focus:ring-[var(--color-primary-muted)]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "transition-colors duration-150",
          error && "border-[var(--color-destructive)]",
          className,
        )}
        {...props}
      />
      {error && (
        <p className="text-xs text-[var(--color-destructive)] font-medium">{error}</p>
      )}
    </div>
  ),
);
Textarea.displayName = "Textarea";
