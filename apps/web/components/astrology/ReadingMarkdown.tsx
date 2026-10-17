"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// ZEAL — Shared reading renderer: AI/deterministic markdown → premium blocks.
// Used by kundali, tarot and horoscope reading phases. Never lets raw markdown
// characters or stray astrological glyphs reach the page.
// Motion policy: apps/web files use full `motion` (no LazyMotion context here).
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";

type ReadingBlock =
  | { kind: "heading"; text: string }
  | { kind: "para"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "table"; columns: string[]; rows: string[][] };

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function isTableSepRow(line: string): boolean {
  if (!line.includes("|")) return false;
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

const ASTRO_GLYPH_CODES: Record<string, string> = {
  "☉": "Su", "☽": "Ch", "☾": "Ch", "♄": "Sa", "♃": "Ju", "♂": "Ma",
  "♀": "Ve", "☿": "Me", "☊": "Ra", "☋": "Ke", "℞": "R",
};

/** Two-char codes for planet glyphs; any other symbol/emoji is dropped —
 *  the page shows premium typography, never stray astrological characters. */
export function sanitizeReading(src: string): string {
  return src
    .replace(/[☉☽☾♄♃♂♀☿☊☋℞]/g, (c) => ASTRO_GLYPH_CODES[c] ?? "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, "");
}

/** Minimal markdown parser for the interpreter's contract: bold-only headings,
 *  pipe tables, "-"/"*" bullets, "1." lists, code fences ignored. */
export function parseReadingBlocks(src: string): ReadingBlock[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReadingBlock[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "para", text: para.join("\n") });
      para = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const t = lines[i]!.trim();
    if (!t) { flushPara(); i++; continue; }
    if (t.startsWith("```")) { i++; continue; }

    const heading = t.match(/^\*\*(.+?)\*\*[:：]?$/);
    if (heading) { flushPara(); blocks.push({ kind: "heading", text: heading[1]! }); i++; continue; }

    if (/^[-*]\s+/.test(t)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i]!.trim())) {
        items.push(lines[i]!.trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    if (/^\d+[.)]\s+/.test(t)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i]!.trim())) {
        items.push(lines[i]!.trim().replace(/^\d+[.)]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    if (t.startsWith("|")) {
      flushPara();
      const raw: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) {
        raw.push(lines[i]!.trim());
        i++;
      }
      const rows = raw.filter((r) => !isTableSepRow(r)).map(splitTableRow);
      if (rows.length) {
        const [head, ...rest] = rows;
        blocks.push({ kind: "table", columns: head!, rows: rest });
      }
      continue;
    }

    para.push(t);
    i++;
  }
  flushPara();
  return blocks;
}

/** **bold** / *italic* → styled nodes — no raw markdown characters reach the page. */
function inlineParts(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .filter(Boolean)
    .map((part, idx) => {
      if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
        return <strong key={idx} className="font-semibold text-foreground/90">{part.slice(2, -2)}</strong>;
      }
      if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
        return <em key={idx}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
}

export function ReadingMarkdown({ source }: { source: string }) {
  const blocks = useMemo(() => parseReadingBlocks(sanitizeReading(source)), [source]);
  return (
    <div className="space-y-1">
      {blocks.map((b, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(0.7 + i * 0.07, 1.8), duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {b.kind === "heading" && (
            <h4 className="mt-6 mb-2.5 flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-foreground">
              <span className="h-4 w-[3px] rounded-full bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500/70 shadow-[0_0_10px_rgba(212,175,55,0.45)]" />
              {inlineParts(b.text)}
            </h4>
          )}
          {b.kind === "para" && (
            <p className="my-2.5 text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
              {b.text.split("\n").map((ln, j) => (
                <span key={j}>
                  {inlineParts(ln)}
                  {j < b.text.split("\n").length - 1 && <br />}
                </span>
              ))}
            </p>
          )}
          {b.kind === "ul" && (
            <ul className="my-3 space-y-2">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2.5 text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
                  <span className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-[0_0_6px_rgba(212,175,55,0.6)]" />
                  <span>{inlineParts(it)}</span>
                </li>
              ))}
            </ul>
          )}
          {b.kind === "ol" && (
            <ol className="my-3 space-y-2.5">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-3 text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-400/25 bg-amber-400/10 text-[10px] font-semibold text-amber-300">
                    {j + 1}
                  </span>
                  <span>{inlineParts(it)}</span>
                </li>
              ))}
            </ol>
          )}
          {b.kind === "table" && (
            <div className="my-4 overflow-hidden rounded-2xl border border-border/50 bg-background/40 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-amber-400/[0.08]">
                      {b.columns.map((c, j) => (
                        <th
                          key={j}
                          className="px-3 py-2.5 text-left font-semibold tracking-wide text-amber-200/90 first:pl-4 last:pr-4"
                        >
                          {inlineParts(c)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr
                        key={j}
                        className={j % 2 === 1 ? "bg-foreground/[0.02] border-t border-border/25" : "border-t border-border/25"}
                      >
                        {r.map((cell, k) => (
                          <td
                            key={k}
                            className={
                              k === 0
                                ? "px-3 py-2 pl-4 font-medium text-foreground/90 first-letter:text-amber-300"
                                : "px-3 py-2 text-muted-foreground last:pr-4"
                            }
                          >
                            {inlineParts(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
