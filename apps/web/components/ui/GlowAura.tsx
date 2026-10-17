"use client";

import { motion } from "framer-motion";

interface GlowAuraProps {
  active: boolean;
  color?: string;
  size?: number;
  className?: string;
}

export default function GlowAura({
  active,
  color = "rgba(245, 158, 11, 0.3)",
  size = 200,
  className = "",
}: GlowAuraProps) {
  if (!active) return null;

  return (
    <motion.div
      className={`absolute pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      }}
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity: [0, 0.8, 0.4, 0], scale: [0.3, 1.2, 1, 0.8] }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      aria-hidden
    />
  );
}
