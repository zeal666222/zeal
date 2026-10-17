"use client";

import { motion } from "framer-motion";

interface MorphBlobsProps {
  blobs?: Array<{
    color: string;
    size: number;
    position: { top?: string; bottom?: string; left?: string; right?: string };
    blur?: number;
    duration?: number;
  }>;
  className?: string;
}

const DEFAULT_BLOBS = [
  { color: "bg-[var(--color-primary)]/[0.06]", size: 500, position: { top: "-128px", right: "-128px" }, blur: 160 },
  { color: "bg-purple-500/[0.05]", size: 400, position: { bottom: "-128px", left: "-128px" }, blur: 140 },
  { color: "bg-amber-500/[0.04]", size: 350, position: { top: "50%", left: "50%" }, blur: 120 },
];

export default function MorphBlobs({ blobs = DEFAULT_BLOBS, className = "" }: MorphBlobsProps) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden>
      {blobs.map((blob, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${blob.color}`}
          style={{
            width: blob.size,
            height: blob.size,
            filter: `blur(${blob.blur}px)`,
            ...blob.position,
            ...(blob.position.top === "50%" ? { transform: "translate(-50%, -50%)" } : {}),
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.3, 0.55, 0.3],
            x: blob.position.top === "50%" ? ["-50%", "-45%", "-55%", "-50%"] : undefined,
            y: blob.position.left === "50%" ? ["-50%", "-55%", "-45%", "-50%"] : undefined,
          }}
          transition={{
            duration: blob.duration ?? (6 + i * 2),
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
