"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

interface ParticleFieldProps {
  count?: number;
  symbols?: string[];
  colors?: string[];
  size?: number;
  className?: string;
}

const DEFAULT_SYMBOLS = ["✦", "✧", "⊹", "◦", "•"];
const DEFAULT_COLORS = [
  "text-amber-400/40",
  "text-purple-400/30",
  "text-cyan-400/30",
  "text-rose-400/30",
  "text-emerald-400/30",
];

export default function ParticleField({
  count = 14,
  symbols = DEFAULT_SYMBOLS,
  colors = DEFAULT_COLORS,
  size = 12,
  className = "",
}: ParticleFieldProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        symbol: symbols[i % symbols.length],
        color: colors[i % colors.length],
        x: Math.random() * 100,
        y: Math.random() * 100,
        duration: 12 + Math.random() * 16,
        delay: Math.random() * -20,
        scale: 0.5 + Math.random() * 1,
        drift: 30 + Math.random() * 60,
      })),
    [count, symbols, colors],
  );

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden>
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className={`absolute ${p.color}`}
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            fontSize: size * p.scale,
          }}
          animate={{
            x: [0, p.drift, -p.drift * 0.6, 0],
            y: [0, -p.drift * 0.8, p.drift * 0.4, 0],
            opacity: [0.2, 0.6, 0.3, 0.2],
            scale: [p.scale, p.scale * 1.3, p.scale * 0.8, p.scale],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        >
          {p.symbol}
        </motion.span>
      ))}
    </div>
  );
}
