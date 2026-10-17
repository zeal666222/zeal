"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface ParticleBurstProps {
  active: boolean;
  count?: number;
  color?: string;
  origin?: { x: string; y: string };
  radius?: number;
  duration?: number;
}

export default function ParticleBurst({
  active,
  count = 16,
  color = "#f59e0b",
  origin = { x: "50%", y: "50%" },
  radius = 80,
  duration = 0.8,
}: ParticleBurstProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), duration * 1000 + 200);
      return () => clearTimeout(t);
    }
  }, [active, duration]);

  if (!visible) return null;

  const particles = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const r = radius * (0.6 + Math.random() * 0.6);
    return {
      id: i,
      tx: Math.cos(angle) * r,
      ty: Math.sin(angle) * r,
      size: 3 + Math.random() * 5,
      delay: Math.random() * 0.15,
    };
  });

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ left: origin.x, top: origin.y, width: 0, height: 0 }}
      aria-hidden
    >
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: color,
            left: 0,
            top: 0,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.tx, y: p.ty, opacity: 0, scale: 0 }}
          transition={{ duration, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
