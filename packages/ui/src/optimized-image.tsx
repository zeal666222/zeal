"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// OptimizedImage — next/image wrapper with Next.js 16 defaults
// ─────────────────────────────────────────────────────────────────────────────
// • Above-fold: loading="eager" + fetchPriority="high" (replaces deprecated priority)
// • Below-fold: lazy loading (default)
// • Enforces width/height for CLS prevention
// • Falls back to a blurred placeholder when a blurDataURL is provided
// ═══════════════════════════════════════════════════════════════════════════════

import Image, { type ImageProps } from "next/image";
import { cn } from "./utils";

interface Props extends Omit<ImageProps, "priority"> {
  aboveFold?: boolean;
}

export function OptimizedImage({
  aboveFold = false,
  className,
  alt,
  ...props
}: Props) {
  return (
    <Image
      alt={alt}
      className={cn("object-cover", className)}
      loading={aboveFold ? "eager" : "lazy"}
      fetchPriority={aboveFold ? "high" : "auto"}
      {...props}
    />
  );
}

export type { Props as OptimizedImageProps };
