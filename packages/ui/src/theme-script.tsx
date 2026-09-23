"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/ui/theme-script
// ─────────────────────────────────────────────────────────────────────────────
// Synchronous, pre-paint theme bootstrap. Runs BEFORE any stylesheet is
// applied and BEFORE React hydrates — the only way to prevent FOUC in SSR.
//
// Reference: next-themes (#no-flash) + Chrome anti-FOUC guidance.
// ═══════════════════════════════════════════════════════════════════════════════

export const THEME_STORAGE_KEY = "theme";

export const NO_FLASH_SCRIPT = [
  "(function(){try{",
  "var k='theme';",
  "var s=localStorage.getItem(k);",
  "var m=window.matchMedia('(prefers-color-scheme: dark)').matches;",
  "var r=(s==='dark')||((!s||s==='system')&&m)?'dark':'light';",
  "var d=document.documentElement;",
  "d.classList.remove('light','dark');",
  "d.classList.add(r);",
  "d.style.colorScheme=r;",
  "var meta=document.querySelector('meta[name=\"theme-color\"]');",
  "if(!meta){meta=document.createElement('meta');meta.setAttribute('name','theme-color');document.head.appendChild(meta);}",
  "meta.setAttribute('content', r==='dark'?'#0a0a0a':'#fafafa');",
  "}catch(e){}})();",
].join("");

export function ThemeScript() {
  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }}
    />
  );
}
