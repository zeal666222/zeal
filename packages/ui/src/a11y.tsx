import type { ReactNode } from "react";
import { cn } from "./utils";

/**
 * VisuallyHidden — content for screen readers only.
 * Reference: WCAG 2.1 SC 1.3.1
 */
export function VisuallyHidden({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("sr-only", className)}>
      {children}
    </span>
  );
}

/**
 * LiveRegion — announces dynamic content to screen readers.
 * Reference: WCAG 2.1 SC 4.1.3
 */
export function LiveRegion({
  children,
  level = "polite",
  className,
}: {
  children: ReactNode;
  level?: "polite" | "assertive" | "off";
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live={level}
      aria-atomic="true"
      className={cn("sr-only", className)}
    >
      {children}
    </div>
  );
}

/**
 * SkipLink — lets keyboard users skip navigation.
 * Reference: WCAG 2.1 SC 2.4.1
 */
export function SkipLink({ href = "#main-content" }: { href?: string }) {
  return (
    <a href={href} className="skip-link">
      Skip to main content
    </a>
  );
}
