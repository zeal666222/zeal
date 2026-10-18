// ═══════════════════════════════════════════════════════════════════════════════
// Uploaded-file detection in chat messages.
// ChatInterface uploads files via /api/upload and appends markdown links:
//   ![name](url) for images, [name](url) for docs/PDFs.
// We detect them, fetch textual attachments server-side, and inject a
// structured directive into the system prompt so the AI actually analyses
// the file rather than ignoring it.
// ═══════════════════════════════════════════════════════════════════════════════

const ATTACHMENT_RE = /(!?)\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;

export interface DetectedFile {
  name: string;
  url: string;
  kind: "image" | "pdf" | "document";
}

export function detectUploadedFiles(content: string): DetectedFile[] {
  const files: DetectedFile[] = [];
  for (const match of content.matchAll(ATTACHMENT_RE)) {
    const url = match[3] ?? "";
    const name = (match[2] || "").trim() || "uploaded file";
    const ext = (url.split("?")[0]?.split(".").pop() ?? "").toLowerCase();
    const kind: DetectedFile["kind"] = ["png", "jpg", "jpeg", "webp", "gif", "avif"].includes(ext)
      ? "image"
      : ext === "pdf"
        ? "pdf"
        : "document";
    files.push({ name, url, kind });
  }
  return files;
}

const TEXTUAL_EXT = new Set(["txt", "md", "csv", "json", "log", "xml", "html", "svg", "vcard", "ics"]);
const MAX_INLINE_CHARS = 6000;

function isTrustedStorageHost(rawUrl: string): boolean {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return false; }
  if (url.protocol !== "https:") return false;
  const hosts = [
    "r2.cloudflarestorage.com",
    "imagedelivery.net",
    "supabase.co",
  ];
  return hosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
}

export async function readTextualAttachment(file: DetectedFile): Promise<string | null> {
  const ext = (file.url.split("?")[0]?.split(".").pop() ?? "").toLowerCase();
  if (!TEXTUAL_EXT.has(ext) || !isTrustedStorageHost(file.url)) return null;
  try {
    const res = await fetch(file.url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const text = await res.text();
    const clipped = text.replace(/\s+/g, " ").trim().slice(0, MAX_INLINE_CHARS);
    return clipped || null;
  } catch {
    return null;
  }
}

export function buildFileAnalysisDirective(
  files: Array<DetectedFile & { extractedText?: string | null }>,
): string {
  if (files.length === 0) return "";
  const lines = files.map((f, i) => {
    const head = `${i + 1}. ${f.kind.toUpperCase()} — "${f.name}" (URL: ${f.url})`;
    return f.extractedText
      ? `${head}\n   EXTRACTED TEXT (already read by our server — analyse this directly):\n   """${f.extractedText}"""`
      : head;
  });
  return [
    "",
    "",
    "[UPLOADED FILES DETECTED IN THIS MESSAGE]",
    ...lines,
    "",
    "FILE-ANALYSIS PROTOCOL (mandatory whenever the seeker attaches files):",
    '1. ACKNOWLEDGE the file first, warmly and specifically — e.g. "Aapne jo palm photo bheji hai, maine use receive kar liya..."',
    '2. EXTRACT RELEVANT DETAILS: where EXTRACTED TEXT is given above, quote and analyse it directly — do not claim you cannot read it. For images, describe what you can actually observe (or infer); if a visual detail cannot be confidently resolved, say so honestly — NEVER invent specifics you cannot see.',
    '3. PROACTIVELY ASK CLARIFYING QUESTIONS about the file — e.g. "Aapne palm photo bheji hai — kya aap right hand ki baat kar rahe hain, aur aapki dominant hand kaunsi hai?" or for a PDF: "Is report mein se kaunsa section aap decode karwana chahenge?" Ask only the 1-2 questions that most change the reading.',
    "4. WEAVE THE FILE into your background analysis and past-event verification before giving any prediction.",
  ].join("\n");
}
