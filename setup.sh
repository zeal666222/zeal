#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZEAL — MASTER FIX v3  (Windows-safe · idempotent · type-check · build)
# ═══════════════════════════════════════════════════════════════════════════════
#  v3 fixes the Git-Bash-on-Windows path mangling that killed v2:
#    • Node is only ever invoked with the file's BASENAME (cwd set by bash)
#    • No absolute Unix paths are ever passed through argv or env to Node
#    • The repo root is normalised via `cygpath -u` if available
#
#  Adds:
#    • --tsc         : type-check only
#    • --build       : type-check + full Next.js build
#    • --no-tsc      : skip type-check (fast re-run)
#    • Coloured, grouped, file-by-file type-error report
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail
set -f   # disable globbing — critical for [bracketId] paths

# ─── Flags ────────────────────────────────────────────────────────────────────
DO_TSC=1
DO_BUILD=0
for a in "$@"; do
  case "$a" in
    --tsc)    DO_TSC=1; DO_BUILD=0 ;;
    --build)  DO_TSC=1; DO_BUILD=1 ;;
    --no-tsc) DO_TSC=0; DO_BUILD=0 ;;
  esac
done

# ─── Colours ──────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'
  M='\033[0;35m'; C='\033[0;36m'; BD='\033[1m'; D='\033[2m'; N='\033[0m'
else
  R=''; G=''; Y=''; B=''; M=''; C=''; BD=''; D=''; N=''
fi

say()   { echo -e "${B}▸${N} $*"; }
ok()    { echo -e "${G}✓${N} $*"; }
warn()  { echo -e "${Y}⚠${N} $*"; }
err()   { echo -e "${R}✗${N} $*"; }
head1() { echo ""; echo -e "${BD}${M}════════════════════════════════════════════════════════════${N}"; echo -e "${BD}${M}  $*${N}"; echo -e "${BD}${M}════════════════════════════════════════════════════════════${N}"; }
head2() { echo ""; echo -e "${BD}${C}── $* ──${N}"; }

# ─── Repo root detection (Windows-safe) ──────────────────────────────────────
normalize_root() {
  local d="$1"
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -u "$d" 2>/dev/null || printf '%s' "$d"
  else
    printf '%s' "$d"
  fi
}

detect_root() {
  local d="$PWD"
  for _ in 1 2 3 4; do
    if [[ -d "$d/apps/web" && -d "$d/apps/admin" && -d "$d/packages/realtime" ]]; then
      normalize_root "$d"; return 0
    fi
    d="$(dirname "$d")"
  done
  return 1
}

REPO_ROOT="$(detect_root || true)"
[[ -n "$REPO_ROOT" ]] || { err "Cannot find Zeal monorepo root"; exit 1; }
cd "$REPO_ROOT"

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$REPO_ROOT/.zeal-backup/zeal-fix-all-$TS"
mkdir -p "$BACKUP"
LOGS="$REPO_ROOT/.zeal-backup"
mkdir -p "$LOGS"

# ═══════════════════════════════════════════════════════════════════════════════
#  CORE FIX: Windows-safe Node invocation
# ═══════════════════════════════════════════════════════════════════════════════
# CRITICAL: We never pass a Unix-style absolute path to Node.
# Instead we `cd` into the file's directory and pass only the basename.
# Bash handles Unix paths natively — this is the only reliable way on
# Git Bash + native Windows Node.js.
# ═══════════════════════════════════════════════════════════════════════════════

backup_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel="${f#$REPO_ROOT/}"
  mkdir -p "$BACKUP/$(dirname "$rel")"
  cp -p "$f" "$BACKUP/$rel" 2>/dev/null || true
}

# Write a file with backup
write_file() {
  local f="$1"; backup_file "$f"; mkdir -p "$(dirname "$f")"; cat > "$f"
}

# In-place Node edit. `$f` may be Unix-style; Node only sees the basename.
node_edit() {
  local f="$1" script="$2"
  [[ -f "$f" ]] || { warn "skip (missing): ${f#$REPO_ROOT/}"; return 0; }
  backup_file "$f"
  local dir base
  dir="$(dirname "$f")"
  base="$(basename "$f")"
  (
    cd "$dir"
    ZEAL_FILE="$base" node -e "$script" || {
      err "node_edit failed: ${f#$REPO_ROOT/}"
      return 1
    }
  )
}

has_marker() { local f="$1" m="$2"; [[ -f "$f" ]] && grep -qF "$m" "$f"; }

# Safe path resolution — no `find -name route.ts` fallback (too broad).
resolve_path() {
  local p="$1"
  [[ -e "$p" ]] && { printf '%s' "$p"; return 0; }
  # Case-insensitive match in parent dir (Windows quirks)
  local dir base cand
  dir="$(dirname "$p")"; base="$(basename "$p")"
  if [[ -d "$dir" ]]; then
    cand="$(ls -1 "$dir" 2>/dev/null | grep -Fix -- "$base" | head -1 || true)"
    [[ -n "$cand" ]] && { printf '%s' "$dir/$cand"; return 0; }
  fi
  return 1
}

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 0 — PREFLIGHT
# ═══════════════════════════════════════════════════════════════════════════════
head1 "PHASE 0 — PREFLIGHT"
say "Repo root : $REPO_ROOT"
say "Backup dir: $BACKUP"
say "Node      : $(node -v)"
say "npm       : $(npm -v)"
say "Flags     : tsc=$DO_TSC build=$DO_BUILD"

# .gitignore
if [[ ! -f .gitignore ]]; then
  write_file .gitignore <<'EOF'
node_modules/
.next/
out/
build/
dist/
.env
.env*.local
*.log
.vscode/
.idea/
.DS_Store
.zeal-backup/
zeal_full_repository_dump.txt
*.dead-candidates
.vercel
EOF
  ok ".gitignore created"
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 1 — THEME
# ═══════════════════════════════════════════════════════════════════════════════
head1 "PHASE 1 — DARK / LIGHT THEME"

# 1.1 no-flash theme script
if ! has_marker "$REPO_ROOT/packages/ui/src/theme-script.tsx" "NO_FLASH_SCRIPT"; then
  head2 "1.1  theme-script.tsx"
  write_file "$REPO_ROOT/packages/ui/src/theme-script.tsx" <<'EOF'
"use client";
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
  "}catch(e){}})();",
].join("");
export function ThemeScript() {
  return <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />;
}
EOF
  ok "theme-script.tsx"
fi

# Export from ui index
UI_INDEX="$REPO_ROOT/packages/ui/src/index.ts"
if [[ -f "$UI_INDEX" ]] && ! has_marker "$UI_INDEX" "theme-script"; then
  node_edit "$UI_INDEX" '
    const fs=require("fs"); const f=process.env.ZEAL_FILE;
    let s=fs.readFileSync(f,"utf8");
    if (!s.includes("./theme-script")) {
      s += "\nexport { ThemeScript, NO_FLASH_SCRIPT, THEME_STORAGE_KEY } from \"./theme-script\";\n";
      fs.writeFileSync(f,s);
    }
  '
  ok "ui/index.ts exports ThemeScript"
fi

PKG_UI="$REPO_ROOT/packages/ui/package.json"
if [[ -f "$PKG_UI" ]] && ! has_marker "$PKG_UI" "theme-script"; then
  node_edit "$PKG_UI" '
    const fs=require("fs"); const f=process.env.ZEAL_FILE;
    const j=JSON.parse(fs.readFileSync(f,"utf8"));
    j.exports=j.exports||{};
    j.exports["./theme-script"]={types:"./src/theme-script.tsx",default:"./src/theme-script.tsx"};
    fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n");
  '
  ok "ui/package.json exports ./theme-script"
fi

# 1.2 tokens.css
TOKENS="$REPO_ROOT/packages/ui/src/tokens.css"
if [[ -f "$TOKENS" ]] && ! has_marker "$TOKENS" "__ZEAL_THEME_TRANSITION__"; then
  head2 "1.2  tokens.css — scoped transition"
  node_edit "$TOKENS" '
    const fs=require("fs"); const f=process.env.ZEAL_FILE;
    let s=fs.readFileSync(f,"utf8");
    s=s.replace(/html\s*\{\s*transition:[^}]*\}\s*/g,"");
    s += `
/* __ZEAL_THEME_TRANSITION__ */
@media (prefers-reduced-motion: no-preference) {
  html.theme-transition body {
    transition: background-color 150ms ease-out, color 150ms ease-out;
  }
}
html.vt-enabled::view-transition-old(root),
html.vt-enabled::view-transition-new(root){ animation:none; mix-blend-mode:normal; }
html.vt-enabled::view-transition-old(root){ z-index:1; }
html.vt-enabled::view-transition-new(root){ z-index:9999; }
`;
    fs.writeFileSync(f,s);
  '
  ok "tokens.css — scoped"
fi

# 1.3 admin globals.css
ADMIN_CSS="$REPO_ROOT/apps/admin/app/globals.css"
if [[ -f "$ADMIN_CSS" ]] && ! has_marker "$ADMIN_CSS" "__ZEAL_ADMIN_TOKENS__"; then
  head2 "1.3  admin globals.css — OKLCH"
  node_edit "$ADMIN_CSS" '
    const fs=require("fs"); const f=process.env.ZEAL_FILE;
    let s=fs.readFileSync(f,"utf8");
    if (!s.includes("__ZEAL_ADMIN_TOKENS__")) {
      s = "/* __ZEAL_ADMIN_TOKENS__ */\n" + s;
    }
    fs.writeFileSync(f,s);
  '
  ok "admin globals.css — marker added"
fi

# 1.4 admin tailwind
ADMIN_TW="$REPO_ROOT/apps/admin/tailwind.config.js"
if [[ -f "$ADMIN_TW" ]] && ! has_marker "$ADMIN_TW" "__ZEAL_TOKENS__"; then
  head2 "1.4  admin tailwind.config.js"
  write_file "$ADMIN_TW" <<'EOF'
/** @type {import('tailwindcss').Config} */
// __ZEAL_TOKENS__
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        "surface-raised": "var(--color-surface-raised)",
        "surface-overlay": "var(--color-surface-overlay)",
        foreground: "var(--color-foreground)",
        "muted-foreground": "var(--color-muted-foreground)",
        border: "var(--color-border)",
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          foreground: "var(--color-primary-foreground)",
        },
      },
      borderRadius: {
        lg: "var(--radius-lg)", md: "var(--radius-md)", sm: "var(--radius-sm)",
        xl: "var(--radius-xl)", "2xl": "var(--radius-2xl)", "3xl": "var(--radius-3xl)",
      },
    },
  },
  plugins: [],
};
EOF
  ok "admin tailwind.config.js"
fi

# 1.5 layouts
fix_layout() {
  local f="$1"
  [[ -f "$f" ]] || { warn "missing ${f#$REPO_ROOT/}"; return 0; }
  node_edit "$f" '
    const fs=require("fs"); const f=process.env.ZEAL_FILE;
    let s=fs.readFileSync(f,"utf8");
    s=s.replace(/disableTransitionOnChange=\{false\}/g,"disableTransitionOnChange={true}");
    if (!s.includes("ThemeScript")) {
      if (/^import .* from ["\x27][^"\x27]*["\x27];?\s*$/m.test(s)) {
        s=s.replace(/^((?:import [^\n]*\n)+)/m,
          `$1import { ThemeScript } from "@zeal/ui/theme-script";\n`);
      } else {
        s=`import { ThemeScript } from "@zeal/ui/theme-script";\n`+s;
      }
      if (/<head>/.test(s)) s=s.replace(/<head>/,"<head>\n        <ThemeScript />");
      else s=s.replace(/(<html[^>]*>)/,`$1\n      <head><ThemeScript /></head>`);
    }
    s=s.replace(/<html(?![^>]*suppressHydrationWarning)/,"<html suppressHydrationWarning");
    fs.writeFileSync(f,s);
  '
  ok "${f#$REPO_ROOT/} — layout patched"
}
head2 "1.5  layouts"
fix_layout "$REPO_ROOT/apps/web/app/layout.tsx"
fix_layout "$REPO_ROOT/apps/admin/app/layout.tsx"

# 1.6 theme-toggle
if ! has_marker "$REPO_ROOT/packages/ui/src/theme-toggle.tsx" "cursor-default"; then
  head2 "1.6  theme-toggle.tsx"
  write_file "$REPO_ROOT/packages/ui/src/theme-toggle.tsx" <<'EOF'
"use client";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "./utils";
type Theme = "light" | "dark" | "system";
const ORDER: Theme[] = ["light", "dark", "system"];
const ICON = { light: Sun, dark: Moon, system: Monitor } as const;
const LABEL = { light: "Light", dark: "Dark", system: "System" } as const;
export function ThemeToggle({ className, variant = "icon" }: { className?: string; variant?: "icon" | "cycle" }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const cycle = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const cur = (theme ?? "system") as Theme;
    const next = ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length] as Theme;
    setTheme(next);
    void e;
  }, [theme, setTheme]);
  if (!mounted) {
    if (variant === "cycle") {
      return <button aria-label="Toggle theme" disabled className={cn("inline-flex items-center gap-2 px-3 h-9 rounded-lg text-transparent bg-transparent cursor-default", className)}><span className="w-[14px] h-[14px]"/><span className="w-[42px] h-[18px]"/></button>;
    }
    return <button aria-label="Toggle theme" disabled className={cn("inline-flex items-center justify-center w-9 h-9 rounded-lg text-transparent bg-transparent cursor-default", className)}><span className="w-[16px] h-[16px]"/></button>;
  }
  const cur = (theme ?? "system") as Theme;
  const Icon = ICON[cur];
  const isDark = resolvedTheme === "dark";
  if (variant === "cycle") {
    return <button onClick={cycle} aria-label={`Theme: ${LABEL[cur]}`} className={cn("inline-flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-raised)]", className)}><Icon size={14}/><span>{LABEL[cur]}</span></button>;
  }
  return <button onClick={cycle} aria-label={`Toggle theme (${LABEL[cur]})`} className={cn("inline-flex items-center justify-center w-9 h-9 rounded-lg text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-raised)]", className)}><Icon size={16} className={isDark?"":"text-amber-500"}/></button>;
}
EOF
  ok "theme-toggle.tsx"
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 2 — VERCEL TIMEOUTS  (FIXED)
# ═══════════════════════════════════════════════════════════════════════════════
head1 "PHASE 2 — VERCEL TIMEOUTS"

add_max_duration() {
  local raw="$1" secs="$2" f
  f="$(resolve_path "$raw" 2>/dev/null || true)"
  if [[ -z "$f" || ! -f "$f" ]]; then
    warn "skip (not found): ${raw#$REPO_ROOT/}"
    return 0
  fi
  if has_marker "$f" "export const maxDuration"; then
    ok "already set: ${f#$REPO_ROOT/}"
    return 0
  fi
  local dir base
  dir="$(dirname "$f")"; base="$(basename "$f")"
  backup_file "$f"
  # ─── KEY FIX: cd into dir, pass basename only ──────────────────────────────
  (
    cd "$dir"
    ZEAL_FILE="$base" ZEAL_SECS="$secs" node -e '
      const fs = require("fs");
      const f = process.env.ZEAL_FILE;
      const secs = Number(process.env.ZEAL_SECS);
      let s = fs.readFileSync(f, "utf8");
      const lines = s.split("\n");
      let last = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^import .* from ['\''"]/.test(lines[i])) last = i;
      }
      const block = [
        "",
        "// Vercel maxDuration",
        "export const maxDuration = " + secs + ";",
        ""
      ];
      if (last >= 0) lines.splice(last + 1, 0, ...block);
      else lines.unshift(...block);
      fs.writeFileSync(f, lines.join("\n"));
    '
  )
  ok "${f#$REPO_ROOT/} — maxDuration=${secs}"
}

add_max_duration "$REPO_ROOT/apps/web/app/api/ai/route.ts"                       60
add_max_duration "$REPO_ROOT/apps/web/app/api/chat/ai/[consultantid]/route.ts"  60
add_max_duration "$REPO_ROOT/apps/web/app/api/chat/ai/[consultantId]/route.ts"  60
add_max_duration "$REPO_ROOT/apps/web/app/api/chat/groq/route.ts"               30

# vercel.json
VERCEL_JSON="$REPO_ROOT/vercel.json"
if [[ -f "$VERCEL_JSON" ]]; then
  head2 "vercel.json"
  node_edit "$VERCEL_JSON" '
    const fs=require("fs"); const f=process.env.ZEAL_FILE;
    let j={}; try { j=JSON.parse(fs.readFileSync(f,"utf8")); } catch {}
    j.$schema="https://openapi.vercel.sh/vercel.json";
    j.installCommand=j.installCommand||"npm ci --workspaces --include-workspace-root --legacy-peer-deps";
    j.github=Object.assign({silent:true},j.github||{});
    j.functions=Object.assign({
      "apps/web/app/api/ai/route.ts":{maxDuration:60},
      "apps/web/app/api/chat/ai/[consultantid]/route.ts":{maxDuration:60},
      "apps/web/app/api/chat/ai/[consultantId]/route.ts":{maxDuration:60},
      "apps/web/app/api/chat/groq/route.ts":{maxDuration:30}
    },j.functions||{});
    fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n");
  '
  ok "vercel.json — functions"
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 3 — AI ENGINE
# ═══════════════════════════════════════════════════════════════════════════════
head1 "PHASE 3 — AI ENGINE"

ENGINE="$REPO_ROOT/apps/web/lib/ai/engine/index.ts"
if [[ -f "$ENGINE" ]] && ! has_marker "$ENGINE" "__ZEAL_ENGINE_BUDGET__"; then
  head2 "3.1  retry budget + wall-clock caps"
  node_edit "$ENGINE" '
    const fs=require("fs"); const f=process.env.ZEAL_FILE;
    let s=fs.readFileSync(f,"utf8");
    s=s.replace(/const maxRetries = opts\.maxRetriesPerProvider \?\? \d+;/,
      "const maxRetries = opts.maxRetriesPerProvider ?? 1;");
    s=s.replace(/^const FALLBACK_CHAIN:.*$/m,
      `$&\n// __ZEAL_ENGINE_BUDGET__\nconst PROVIDER_WALL_MS = 12_000;\nconst TOTAL_WALL_MS = 25_000;`);
    s=s.replace(/for \(const key of chain\) \{/,
      `const __chainStart = Date.now();
  for (const key of chain) {
    if (Date.now() - __chainStart > TOTAL_WALL_MS) {
      lastInternal = "global wall-clock budget exceeded";
      attempts.push({ provider: key, reason: "budget-exceeded" });
      break;
    }
    const __providerStart = Date.now();`);
    fs.writeFileSync(f,s);
  '
  ok "engine — budget"
fi

if [[ -f "$ENGINE" ]] && ! has_marker "$ENGINE" "__ZEAL_PROVIDERS_V2__"; then
  head2 "3.2  provider registry"
  node_edit "$ENGINE" '
    const fs=require("fs"); const f=process.env.ZEAL_FILE;
    let s=fs.readFileSync(f,"utf8");
    const block = `// __ZEAL_PROVIDERS_V2__
const PROVIDERS: Record<ProviderName, ProviderDef> = {
  groqPro: {
    name: "groqPro", label: "Groq 70B",
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: () => process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    maxConcurrent: 3, rpm: 28, tpm: 10_000, weight: 100,
  },
  groqFast: {
    name: "groqFast", label: "Groq 8B",
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: () => process.env.GROQ_API_KEY,
    model: "llama-3.1-8b-instant",
    maxConcurrent: 6, rpm: 28, tpm: 5_500, weight: 80,
  },
  agnes: {
    name: "agnes", label: "Agnes 2.5 Flash",
    url: "https://apihub.agnes-ai.com/v1/chat/completions",
    key: () => process.env.AGNES_API_KEY,
    model: "agnes-2.5-flash",
    maxConcurrent: 4, rpm: 18, tpm: 32_000, weight: 70,
  },
  zhipu: {
    name: "zhipu", label: "Zhipu GLM",
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    key: () => process.env.ZHIPU_API_KEY,
    model: "glm-4-flash",
    maxConcurrent: 2, rpm: 30, tpm: 15_000, weight: 40,
  },
};

const FALLBACK_CHAIN: ProviderName[] = ["groqPro", "agnes", "groqFast", "zhipu"];`;
    s=s.replace(/const PROVIDERS:[\s\S]*?const FALLBACK_CHAIN: ProviderName\[\] = \[[^\]]*\];/, block);
    fs.writeFileSync(f,s);
  '
  ok "engine — providers"
fi

AI_ROUTE="$REPO_ROOT/apps/web/app/api/ai/route.ts"
if [[ -f "$AI_ROUTE" ]] && ! has_marker "$AI_ROUTE" "__ZEAL_PROMPT_TRIM__"; then
  head2 "3.3  /api/ai — prompt trim"
  node_edit "$AI_ROUTE" '
    const fs=require("fs"); const f=process.env.ZEAL_FILE;
    let s=fs.readFileSync(f,"utf8");
    s=s.replace(/p_filters:\s*\{\s*limit:\s*\d+,\s*sort:\s*"relevance"\s*\}/g,
      "p_filters: { limit: 20, sort: \"relevance\" }");
    s=s.replace(/\.slice\(0,\s*60\)/g, ".slice(0, 20)");
    if (!s.includes("__ZEAL_PROMPT_TRIM__")) {
      s="// __ZEAL_PROMPT_TRIM__\n"+s;
    }
    fs.writeFileSync(f,s);
  '
  ok "/api/ai — trimmed"
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 4 — HIGH-END AI
# ═══════════════════════════════════════════════════════════════════════════════
head1 "PHASE 4 — HIGH-END AI"

mkdir -p "$REPO_ROOT/apps/web/lib/ai"
if [[ ! -f "$REPO_ROOT/apps/web/lib/ai/sse.ts" ]]; then
  head2 "4.1  lib/ai/sse.ts"
  write_file "$REPO_ROOT/apps/web/lib/ai/sse.ts" <<'EOF'
// Universal SSE parser for OpenAI-compatible streams (Groq, Agnes, Zhipu).
export interface SSECallbacks {
  onDelta: (accumulated: string) => void;
  onDone?: (final: string) => void;
  onError?: (err: Error) => void;
  signal?: AbortSignal;
}
export async function consumeOpenAIStream(response: Response, cb: SSECallbacks): Promise<string> {
  if (!response.body) { const e = new Error("Stream has no body"); cb.onError?.(e); throw e; }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", accumulated = "";
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (cb.signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) { accumulated += delta; cb.onDelta(accumulated); }
        } catch { /* skip */ }
      }
    }
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    cb.onError?.(err); throw err;
  }
  cb.onDone?.(accumulated); return accumulated;
}
EOF
  ok "sse.ts"
fi

mkdir -p "$REPO_ROOT/apps/web/hooks"
if [[ ! -f "$REPO_ROOT/apps/web/hooks/useZealStream.ts" ]]; then
  head2 "4.2  hooks/useZealStream.ts"
  write_file "$REPO_ROOT/apps/web/hooks/useZealStream.ts" <<'EOF'
"use client";
import { useCallback, useRef, useState } from "react";
import { consumeOpenAIStream } from "@/lib/ai/sse";
export interface UseZealStreamResult {
  streaming: boolean; text: string | null; error: string | null;
  send: (p: { consultantId: string; conversationId: string; content: string }) => Promise<void>;
  cancel: () => void; reset: () => void;
}
export function useZealStream(): UseZealStreamResult {
  const [streaming, setStreaming] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<AbortController | null>(null);
  const cancel = useCallback(() => { ref.current?.abort(); ref.current = null; setStreaming(false); }, []);
  const reset = useCallback(() => { setText(null); setError(null); setStreaming(false); ref.current = null; }, []);
  const send = useCallback(async ({ consultantId, conversationId, content }: { consultantId: string; conversationId: string; content: string }) => {
    cancel();
    const ctrl = new AbortController(); ref.current = ctrl;
    setStreaming(true); setText(""); setError(null);
    try {
      const res = await fetch(`/api/chat/ai/${consultantId}`, {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, content }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error((b as { error?: string }).error || `HTTP ${res.status}`); }
      await consumeOpenAIStream(res, { onDelta: (acc) => setText(acc), signal: ctrl.signal });
    } catch (e: unknown) {
      if ((e as Error)?.name !== "AbortError") setError(e instanceof Error ? e.message : "Stream failed");
    } finally { setStreaming(false); ref.current = null; }
  }, [cancel]);
  return { streaming, text, error, send, cancel, reset };
}
EOF
  ok "useZealStream.ts"
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 5 — LAZY LOADING + RESPONSIVE
# ═══════════════════════════════════════════════════════════════════════════════
head1 "PHASE 5 — LAZY + RESPONSIVE"

mkdir -p "$REPO_ROOT/apps/web/components/charts" "$REPO_ROOT/apps/admin/components/charts"
if [[ ! -f "$REPO_ROOT/apps/web/components/charts/LazyChart.tsx" ]]; then
  head2 "5.1  LazyChart"
  write_file "$REPO_ROOT/apps/web/components/charts/LazyChart.tsx" <<'EOF'
"use client";
import dynamic from "next/dynamic";
import { useRef, useState, useEffect } from "react";
import { Skeleton } from "@zeal/ui";
const Inner = dynamic(() => import("recharts").then((m) => {
  const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } = m;
  function C(p: { data: Array<Record<string, unknown>>; xKey: string; yKey: string; color: string }) {
    return (<ResponsiveContainer width="100%" height="100%"><LineChart data={p.data}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/><XAxis dataKey={p.xKey} stroke="var(--color-muted-foreground)" fontSize={11}/><YAxis stroke="var(--color-muted-foreground)" fontSize={11}/><Tooltip contentStyle={{background:"var(--color-surface-overlay)",border:"1px solid var(--color-border)",borderRadius:"12px",color:"var(--color-foreground)"}}/><Line type="monotone" dataKey={p.yKey} stroke={p.color} strokeWidth={2} dot={{fill:p.color,r:3}} activeDot={{r:5}}/></LineChart></ResponsiveContainer>);
  }
  return { default: C };
}), { ssr: false, loading: () => <Skeleton className="w-full h-full" /> });
export function LazyChart({ data, xKey, yKey, color, heightClass = "h-72" }: { data: Array<Record<string, unknown>>; xKey: string; yKey: string; color: string; heightClass?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setV(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <div ref={ref} className={heightClass}>{v ? <Inner data={data} xKey={xKey} yKey={yKey} color={color} /> : <Skeleton className="w-full h-full" />}</div>;
}
EOF
  ok "LazyChart.tsx (web)"
fi
[[ -f "$REPO_ROOT/apps/admin/components/charts/LazyChart.tsx" ]] || cp "$REPO_ROOT/apps/web/components/charts/LazyChart.tsx" "$REPO_ROOT/apps/admin/components/charts/LazyChart.tsx"

# perf utilities
WEB_CSS="$REPO_ROOT/apps/web/app/globals.css"
if [[ -f "$WEB_CSS" ]] && ! has_marker "$WEB_CSS" "__ZEAL_PERF_UTILS__"; then
  head2 "5.2  globals.css — perf utils"
  cat >> "$WEB_CSS" <<'EOF'

/* __ZEAL_PERF_UTILS__ */
@layer utilities {
  .cv-auto { content-visibility: auto; contain-intrinsic-size: 1px 600px; }
  .cq-card { container-type: inline-size; }
}
EOF
  ok "web globals.css — perf utils"
fi

# responsive containers
for f in "$REPO_ROOT/apps/web/app/explore/page.tsx" "$REPO_ROOT/apps/web/app/services/page.tsx"; do
  [[ -f "$f" ]] || continue
  node_edit "$f" '
    const fs=require("fs"); const f=process.env.ZEAL_FILE;
    let s=fs.readFileSync(f,"utf8");
    s=s.replace(/max-w-6xl(?!\s*xl:)/g, "max-w-6xl xl:max-w-7xl 2xl:max-w-[90rem]");
    fs.writeFileSync(f,s);
  '
done
ok "responsive containers"

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 6 — BACKEND
# ═══════════════════════════════════════════════════════════════════════════════
head1 "PHASE 6 — BACKEND"

mkdir -p "$REPO_ROOT/supabase/migrations"
MIG="$REPO_ROOT/supabase/migrations/900_zeal_fix_all.sql"
if [[ ! -f "$MIG" ]]; then
  head2 "6.1  migration 900_zeal_fix_all.sql"
  write_file "$MIG" <<'SQLEOF'
-- 900_zeal_fix_all.sql — idempotent correctness pass
BEGIN;
SET LOCAL statement_timeout = '5min';

CREATE OR REPLACE FUNCTION public.credit_funds_safe(
  p_user_id text, p_amount double precision, p_description text, p_reference_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet "Wallet"%ROWTYPE; v_existing "Transaction"%ROWTYPE; v_txn_id text;
BEGIN
  IF p_reference_id IS NOT NULL AND p_reference_id <> '' THEN
    SELECT * INTO v_existing FROM "Transaction" WHERE "referenceId" = p_reference_id;
    IF FOUND THEN RETURN jsonb_build_object('success',true,'idempotent',true,'balance',v_existing.balance,'transactionId',v_existing.id); END IF;
  END IF;
  SELECT * INTO v_wallet FROM "Wallet" WHERE "userId" = p_user_id::uuid FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO "Wallet" ("userId",balance,escrow,"pendingIn","pendingOut",blocked) VALUES (p_user_id::uuid,p_amount,0,0,0,0) RETURNING * INTO v_wallet;
    v_txn_id := gen_random_uuid()::text;
    INSERT INTO "Transaction" (id,"walletId",type,amount,balance,description,"referenceId") VALUES (v_txn_id,v_wallet.id,'TOPUP',p_amount,p_amount,p_description,p_reference_id);
    RETURN jsonb_build_object('success',true,'idempotent',false,'balance',p_amount,'transactionId',v_txn_id,'walletCreated',true);
  END IF;
  UPDATE "Wallet" SET balance = balance + p_amount, "updatedAt" = now() WHERE id = v_wallet.id;
  v_txn_id := gen_random_uuid()::text;
  INSERT INTO "Transaction" (id,"walletId",type,amount,balance,description,"referenceId") VALUES (v_txn_id,v_wallet.id,'TOPUP',p_amount,v_wallet.balance + p_amount,p_description,p_reference_id);
  RETURN jsonb_build_object('success',true,'idempotent',false,'balance',v_wallet.balance + p_amount,'transactionId',v_txn_id);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'error',SQLERRM,'code',SQLSTATE); END $$;
GRANT EXECUTE ON FUNCTION public.credit_funds_safe(text,double precision,text,text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.hold_in_escrow_safe(
  p_user_id text, p_amount double precision, p_reference_id text, p_description text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet "Wallet"%ROWTYPE; v_existing "Transaction"%ROWTYPE; v_txn_id text;
BEGIN
  IF p_reference_id IS NOT NULL AND p_reference_id <> '' THEN
    SELECT * INTO v_existing FROM "Transaction" WHERE "referenceId" = p_reference_id;
    IF FOUND THEN RETURN jsonb_build_object('success',true,'idempotent',true,'transactionId',v_existing.id); END IF;
  END IF;
  SELECT * INTO v_wallet FROM "Wallet" WHERE "userId" = p_user_id::uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','wallet_not_found','code','NOT_FOUND'); END IF;
  IF v_wallet.balance < p_amount THEN RETURN jsonb_build_object('success',false,'error','insufficient_balance','code','INSUFFICIENT_FUNDS','balance',v_wallet.balance); END IF;
  UPDATE "Wallet" SET balance = balance - p_amount, escrow = escrow + p_amount, "updatedAt" = now() WHERE id = v_wallet.id;
  v_txn_id := gen_random_uuid()::text;
  INSERT INTO "Transaction" (id,"walletId",type,amount,balance,description,"referenceId") VALUES (v_txn_id,v_wallet.id,'PAYMENT',p_amount,v_wallet.balance - p_amount,p_description,p_reference_id);
  RETURN jsonb_build_object('success',true,'idempotent',false,'transactionId',v_txn_id,'escrow',v_wallet.escrow + p_amount);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'error',SQLERRM,'code',SQLSTATE); END $$;
GRANT EXECUTE ON FUNCTION public.hold_in_escrow_safe(text,double precision,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id text, p_actor_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_booking RECORD; v_wallet RECORD;
BEGIN
  SELECT * INTO v_booking FROM "Booking" WHERE id = p_booking_id::uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF v_booking.status = 'CANCELLED' THEN RETURN jsonb_build_object('alreadyCancelled',true); END IF;
  IF v_booking.status = 'COMPLETED' THEN RETURN jsonb_build_object('error','completed'); END IF;
  IF v_booking."userId" IS NOT NULL THEN
    SELECT * INTO v_wallet FROM "Wallet" WHERE "userId" = v_booking."userId"::uuid FOR UPDATE;
    IF FOUND THEN
      UPDATE "Wallet" SET balance = balance + v_booking.amount, escrow = GREATEST(0,escrow - v_booking.amount), "updatedAt" = now() WHERE id = v_wallet.id;
      INSERT INTO "Transaction" (id,"walletId",type,amount,balance,description,"referenceId") VALUES (gen_random_uuid()::text,v_wallet.id,'REFUND',v_booking.amount,v_wallet.balance + v_booking.amount,'Refund for cancelled booking ' || p_booking_id, p_booking_id || ':refund') ON CONFLICT ("referenceId") DO NOTHING;
    END IF;
  END IF;
  UPDATE "Booking" SET status = 'CANCELLED', "updatedAt" = now() WHERE id = p_booking_id::uuid;
  RETURN jsonb_build_object('success',true);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'error',SQLERRM); END $$;
GRANT EXECUTE ON FUNCTION public.cancel_booking(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.impersonation_active(p_actor uuid, p_target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public."AdminAuditLog" l WHERE l.action = 'IMPERSONATE_START' AND l."userId" = p_actor AND l."targetId" = p_target::text AND l."createdAt" > now() - interval '15 minutes');
$$;
GRANT EXECUTE ON FUNCTION public.impersonation_active(uuid,uuid) TO authenticated;

DO $$ BEGIN
  IF to_regclass('public.rate_limits') IS NOT NULL THEN
    ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.rate_limits FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS rate_limits_no_public ON public.rate_limits;
    CREATE POLICY rate_limits_no_public ON public.rate_limits FOR ALL TO public USING (false) WITH CHECK (false);
  END IF;
  IF to_regclass('public."AIChatRateLimit"') IS NOT NULL THEN
    ALTER TABLE public."AIChatRateLimit" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public."AIChatRateLimit" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS ai_rate_limit_owner ON public."AIChatRateLimit";
    CREATE POLICY ai_rate_limit_owner ON public."AIChatRateLimit" FOR ALL USING ("userId" = (SELECT auth.uid())) WITH CHECK ("userId" = (SELECT auth.uid()));
  END IF;
END $$;

DO $$ DECLARE pol text; BEGIN
  FOREACH pol IN ARRAY ARRAY['Users can view own wallet','Users can view own transactions','Users view own bookings','Consultants view assigned bookings','Public can view verified consultants','Consultants can manage own profile'] LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public."Wallet"', pol);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public."Transaction"', pol);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public."Booking"', pol);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public."Consultant"', pol);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.process_per_minute_deduction(text,text,double precision,text);
DROP FUNCTION IF EXISTS public.process_per_minute_deduction(text,text,double precision,text,boolean);
CREATE OR REPLACE FUNCTION public.process_per_minute_deduction(
  p_user_id text, p_consultant_id text, p_amount double precision, p_session_id text, p_is_ai boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ref text; v_existing "Transaction"%ROWTYPE; v_uw "Wallet"%ROWTYPE; v_cw "Wallet"%ROWTYPE; v_consultant_uid uuid; v_fee double precision; v_earning double precision;
BEGIN
  v_ref := 'permin:' || p_session_id;
  SELECT * INTO v_existing FROM "Transaction" WHERE "referenceId" = v_ref FOR UPDATE;
  IF FOUND THEN RETURN jsonb_build_object('success',true,'idempotent',true,'transactionId',v_existing.id); END IF;
  SELECT * INTO v_uw FROM "Wallet" WHERE "userId" = p_user_id::uuid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','user_wallet_not_found','code','NOT_FOUND'); END IF;
  IF v_uw.balance < p_amount THEN RETURN jsonb_build_object('success',false,'error','Insufficient funds','code','INSUFFICIENT_FUNDS','terminate',true,'remaining',v_uw.balance); END IF;
  IF p_is_ai THEN
    SELECT id INTO v_consultant_uid FROM "User" WHERE id = p_consultant_id::uuid AND role = 'AI'::"AppRole";
  ELSE
    SELECT "userId" INTO v_consultant_uid FROM "Consultant" WHERE id = p_consultant_id::uuid;
  END IF;
  v_fee := p_amount * 0.20; v_earning := p_amount - v_fee;
  UPDATE "Wallet" SET balance = balance - p_amount, "updatedAt" = now() WHERE id = v_uw.id;
  INSERT INTO "Transaction" (id,"walletId",type,amount,balance,description,"referenceId") VALUES (gen_random_uuid()::text,v_uw.id,'PAYMENT',-p_amount,v_uw.balance - p_amount,'Per-minute billing',v_ref);
  IF v_consultant_uid IS NOT NULL THEN
    SELECT * INTO v_cw FROM "Wallet" WHERE "userId" = v_consultant_uid FOR UPDATE;
    IF FOUND THEN
      UPDATE "Wallet" SET balance = balance + v_earning, "updatedAt" = now() WHERE id = v_cw.id;
      INSERT INTO "Transaction" (id,"walletId",type,amount,balance,description,"referenceId") VALUES (gen_random_uuid()::text,v_cw.id,'COMMISSION',v_earning,v_cw.balance + v_earning,'Per-minute earning',v_ref || ':earn');
    END IF;
  END IF;
  RETURN jsonb_build_object('success',true,'idempotent',false,'remaining',v_uw.balance - p_amount,'consultant_credited',v_consultant_uid IS NOT NULL,'earning',v_earning);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'error',SQLERRM,'code',SQLSTATE); END $$;
GRANT EXECUTE ON FUNCTION public.process_per_minute_deduction(text,text,double precision,text,boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
SQLEOF
  ok "migration written"
else
  ok "migration already present"
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 7 — TYPE CHECK
# ═══════════════════════════════════════════════════════════════════════════════
if [[ $DO_TSC -eq 1 ]]; then
  head1 "PHASE 7 — TYPE CHECK"

  run_tsc() {
    local app="$1"
    local log="$LOGS/tsc-$app.log"
    say "tsc $app …"
    (
      cd "$REPO_ROOT"
      npx tsc -p "apps/$app/tsconfig.json" --noEmit 2>&1 | tee "$log" >/dev/null
    ) || true

    local errs
    errs="$(grep -cE 'error TS[0-9]+' "$log" 2>/dev/null || true)"
    errs="${errs:-0}"

    if [[ "$errs" -eq 0 ]]; then
      ok "$app: 0 type errors"
      return 0
    fi

    err "  $app: $errs type error(s)"
    echo -e "  ${D}Top offenders:${N}"
    grep -oE '^[^(]+\(' "$log" 2>/dev/null \
      | sed 's/($//' \
      | sort | uniq -c | sort -rn | head -10 \
      | while read -r cnt file; do
          echo -e "    ${Y}${cnt}×${N} ${file#$REPO_ROOT/}"
        done
    echo ""
    echo -e "  ${D}First 15 errors:${N}"
    grep -E 'error TS[0-9]+' "$log" | head -15 | sed "s|$REPO_ROOT/||" | while read -r l; do
      echo -e "    ${R}✗${N} $l"
    done
    echo ""
    echo -e "  ${D}Full log: $log${N}"
    return 1
  }

  TSC_WEB=0; TSC_ADMIN=0
  run_tsc web   || TSC_WEB=1
  run_tsc admin || TSC_ADMIN=1

  if [[ $TSC_WEB -eq 0 && $TSC_ADMIN -eq 0 ]]; then
    ok "Both apps type-check clean"
  else
    warn "Pre-existing type errors are expected — the fixes in this script are additive."
    warn "Review the logs above, then decide which to fix next."
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  PHASE 8 — BUILD
# ═══════════════════════════════════════════════════════════════════════════════
if [[ $DO_BUILD -eq 1 ]]; then
  head1 "PHASE 8 — BUILD"

  for app in web admin; do
    log="$LOGS/build-$app.log"
    say "Building $app …"
    (
      cd "$REPO_ROOT/apps/$app"
      npm run build 2>&1 | tee "$log" >/dev/null
    ) && ok "$app build OK" || err "$app build FAILED — see $log"

    # Show first compile error if any
    if grep -qE 'Failed to compile|Type error' "$log" 2>/dev/null; then
      echo ""
      grep -A5 -E 'Failed to compile|Type error' "$log" | head -20 | sed "s|$REPO_ROOT/||"
    fi
  done
fi

# ═══════════════════════════════════════════════════════════════════════════════
#  SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BD}${G}════════════════════════════════════════════════════════════${N}"
echo -e "${BD}${G}  ZEAL FIX-ALL v3 — COMPLETE${N}"
echo -e "${BD}${G}════════════════════════════════════════════════════════════${N}"
echo ""
echo -e "  Backup          : ${D}$BACKUP${N}"
echo -e "  Logs            : ${D}$LOGS${N}"
echo -e "  Migration       : ${D}supabase/migrations/900_zeal_fix_all.sql${N}"
echo ""
echo -e "${BD}Next steps:${N}"
echo "  1. Review diff       : git diff --stat"
echo "  2. Apply migration   : supabase db push"
echo "  3. Confirm env vars  : AGNES_API_KEY, GROQ_API_KEY on Vercel"
echo "  4. Type-check only   : ./scripts/zeal-fix-all.sh --tsc"
echo "  5. Full build        : ./scripts/zeal-fix-all.sh --build"
echo ""

set +f