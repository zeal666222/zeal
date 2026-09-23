"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/ui/theme-toggle — three-way cycle, no layout shift, safe View Transitions
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "./utils";

type Theme = "light" | "dark" | "system";
const ORDER: Theme[] = ["light", "dark", "system"];
const ICON = { light: Sun, dark: Moon, system: Monitor } as const;
const LABEL = { light: "Light", dark: "Dark", system: "System" } as const;

interface Props {
  className?: string;
  variant?: "icon" | "cycle";
}

export function ThemeToggle({ className, variant = "icon" }: Props) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const cycle = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const current = (theme ?? "system") as Theme;
      const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] as Theme;

      const supportsVT =
        typeof document !== "undefined" &&
        "startViewTransition" in document &&
        window.matchMedia("(prefers-reduced-motion: no-preference)").matches;

      if (!supportsVT) { setTheme(next); return; }

      const html = document.documentElement;
      html.classList.add("vt-enabled");
      const x = e.clientX, y = e.clientY;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vt = (document as any).startViewTransition(() => setTheme(next));
      vt.ready
        .then(() => {
          html.animate(
            [{ clipPath: `circle(0px at ${x}px ${y}px)` },
             { clipPath: `circle(${endRadius}px at ${x}px ${y}px)` }],
            { duration: 480, easing: "cubic-bezier(.2,.8,.2,1)",
              pseudoElement: "::view-transition-new(root)" },
          );
        })
        .finally(() => setTimeout(() => html.classList.remove("vt-enabled"), 600));
    },
    [theme, setTheme],
  );

  if (!mounted) {
    if (variant === "cycle") {
      return (
        <button aria-label="Toggle theme" disabled
          className={cn("inline-flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium text-transparent bg-transparent cursor-default", className)}>
          <span className="inline-block w-[14px] h-[14px]" />
          <span className="inline-block w-[42px] h-[18px]" />
        </button>
      );
    }
    return (
      <button aria-label="Toggle theme" disabled
        className={cn("inline-flex items-center justify-center w-9 h-9 rounded-lg text-transparent bg-transparent cursor-default", className)}>
        <span className="inline-block w-[16px] h-[16px]" />
      </button>
    );
  }

  const current = (theme ?? "system") as Theme;
  const Icon = ICON[current];
  const isDark = resolvedTheme === "dark";

  if (variant === "cycle") {
    return (
      <button onClick={cycle} aria-label={`Theme: ${LABEL[current]}`}
        className={cn("inline-flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium transition-colors duration-150 hover:bg-[var(--color-surface-raised)] text-[var(--color-muted-foreground)]", className)}>
        <Icon size={14} />
        <span>{LABEL[current]}</span>
      </button>
    );
  }

  return (
    <button onClick={cycle} aria-label={`Toggle theme (${LABEL[current]})`}
      className={cn("inline-flex items-center justify-center w-9 h-9 rounded-lg text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-foreground)] transition-colors duration-150", className)}>
      <Icon size={16} className={isDark ? "" : "text-amber-500"} />
    </button>
  );
}
