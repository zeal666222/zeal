"use client";

import { motion } from "framer-motion";

interface ShimmerOverlayProps {
  active?: boolean;
  className?: string;
  direction?: "left" | "right";
  duration?: number;
  color?: string;
}

export default function ShimmerOverlay({
  active = true,
  className = "",
  direction = "right",
  duration = 1.2,
  color = "rgba(255,255,255,0.1)",
}: ShimmerOverlayProps) {
  if (!active) return null;

  const startX = direction === "right" ? "-100%" : "100%";
  const endX = direction === "right" ? "100%" : "-100%";

  return (
    <motion.div
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      aria-hidden
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${color} 40%, ${color.replace("0.1", "0.18")} 50%, ${color} 60%, transparent 100%)`,
        }}
        initial={{ x: startX }}
        animate={{ x: endX }}
        transition={{ duration, ease: "easeInOut" }}
      />
    </motion.div>
  );
}
