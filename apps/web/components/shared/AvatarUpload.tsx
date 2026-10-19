"use client";
// =============================================================================
// AvatarUpload — premium file picker with preview + progress
// =============================================================================
// Drop-in for any <form> that has a hidden <input name="avatar">.
// Uploads to /api/upload with folder=avatars, then writes the returned URL
// into the hidden input so the parent form action picks it up on submit.
// =============================================================================

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X } from "lucide-react";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const TARGET_PX = 512;

// Centre-crop + downscale to a square WebP under 300 KB. Keeps every consumer
// (header chip, comment thread, chat bubble) rendering one canonical asset
// instead of four different aspect ratios. Rejects gracefully — the caller
// falls back to the raw file if the browser can't encode WebP.
async function normalizeAvatar(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const sx = Math.max(0, (bmp.width - side) / 2);
  const sy = Math.max(0, (bmp.height - side) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_PX;
  canvas.height = TARGET_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bmp.close?.();
    return file;
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, sx, sy, side, side, 0, 0, TARGET_PX, TARGET_PX);
  bmp.close?.();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.88),
  );
  if (!blob) return file;
  // If WebP produced something bigger than the source (rare), keep the source.
  if (blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.(jpe?g|png|webp)$/i, "") + ".webp", {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

interface Props {
  /** Current avatar URL (full URL or storage key) — used as initial preview. */
  defaultValue?: string | null;
  /** Name of the hidden input to write the uploaded URL into. */
  inputName?: string;
  /** Size of the circular preview (Tailwind classes). */
  size?: "sm" | "md" | "lg";
  /** Fired the moment the file lands in storage, before the parent form submits.
   *  Lets callers optimistic-patch the store so the header chip swaps instantly. */
  onUploaded?: (url: string) => void;
}

const SIZE_MAP = {
  sm: { ring: "w-16 h-16", icon: 14, overlay: "text-[8px]" },
  md: { ring: "w-24 h-24", icon: 18, overlay: "text-[9px]" },
  lg: { ring: "w-32 h-32", icon: 22, overlay: "text-[10px]" },
} as const;

export function AvatarUpload({
  defaultValue,
  inputName = "avatar",
  size = "md",
  onUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(defaultValue ?? null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const dim = SIZE_MAP[size];

  const handleClick = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      // --- validation ---
      if (!ALLOWED_TYPES.has(file.type)) {
        setError("Only JPEG, PNG, or WebP images");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("Image must be under 5 MB");
        return;
      }

      // --- local preview ---
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      // --- upload ---
      setUploading(true);
      setProgress(0);

      try {
        // Downscale to 512×512 square (center crop) before upload — faster
        // transfer, uniform aspect across every header chip and card, less
        // storage. Falls through to the raw file if canvas encoding fails
        // (Safari edge cases with certain WebP variants).
        const payload = await normalizeAvatar(file).catch(() => file);

        const form = new FormData();
        form.append("file", payload, payload.name || "avatar.jpg");
        form.append("folder", "avatars");

        // Simulate progress with XHR (fetch doesn't expose upload progress)
        const uploadedUrl = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/upload");

          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          });

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const json = JSON.parse(xhr.responseText);
                resolve(json.url as string);
              } catch {
                reject(new Error("Invalid upload response"));
              }
            } else {
              try {
                const json = JSON.parse(xhr.responseText);
                reject(new Error(json.error || `Upload failed (${xhr.status})`));
              } catch {
                reject(new Error(`Upload failed (${xhr.status})`));
              }
            }
          };

          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.send(form);
        });

        // Write URL into the hidden input so the form action picks it up
        if (inputRef.current) {
          inputRef.current.value = uploadedUrl;
        }

        // Dispatch an input event so React controlled inputs stay in sync
        inputRef.current?.dispatchEvent(new Event("input", { bubbles: true }));

        // Optimistic broadcast — the profile-edit page uses this to swap the
        // header chip and profile-page hero before the server action returns.
        onUploaded?.(uploadedUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        // Revert preview on failure
        setPreview(defaultValue ?? null);
      } finally {
        setUploading(false);
        setProgress(0);
        // Clean up object URL to avoid memory leak
        URL.revokeObjectURL(objectUrl);
      }
    },
    [defaultValue, onUploaded],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setPreview(null);
      setError(null);
      if (inputRef.current) inputRef.current.value = "";
      inputRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
    },
    [],
  );

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Hidden input — always present so the form action receives the value */}
      <input ref={inputRef} type="hidden" name={inputName} defaultValue={defaultValue ?? ""} />

      {/* File input (invisible) */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          // Reset so selecting the same file again triggers onChange
          e.target.value = "";
        }}
      />

      {/* Avatar ring */}
      <button
        type="button"
        onClick={handleClick}
        onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
        className={`relative ${dim.ring} rounded-full overflow-hidden
          bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)]
          ring-2 transition-all duration-200 active:scale-95 cursor-pointer
          flex items-center justify-center
          ${dragOver ? "ring-[var(--color-primary)] scale-105 shadow-lg shadow-[var(--color-primary)]/30" : "ring-transparent hover:ring-[var(--color-primary)]/40"}`}
        aria-label="Change avatar"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Avatar preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <Camera size={dim.icon} className="text-white/80" />
        )}

        {/* Upload overlay — real progress ring, not just a spinner */}
        <AnimatePresence>
          {uploading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center"
            >
              <svg viewBox="0 0 44 44" className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                <circle
                  cx="22" cy="22" r="20" fill="none" stroke="white" strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 20}
                  strokeDashoffset={2 * Math.PI * 20 * (1 - progress / 100)}
                  style={{ transition: "stroke-dashoffset 200ms ease" }}
                />
              </svg>
              <span className={`${dim.overlay} font-black text-white`}>{progress}%</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drag hint (only when not uploading) */}
        {!uploading && dragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-[var(--color-primary)]/40 backdrop-blur-sm flex items-center justify-center text-white text-[10px] font-black tracking-widest"
          >
            RELEASE
          </motion.div>
        )}

        {/* Hover overlay (only when not uploading) */}
        {!uploading && (
          <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
            <Camera size={dim.icon} className="text-white" />
          </div>
        )}

        {/* Clear button */}
        {preview && !uploading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg hover:bg-rose-600 transition-colors z-10"
            aria-label="Remove avatar"
          >
            <X size={10} />
          </button>
        )}
      </button>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-[10px] font-bold text-rose-400"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {!uploading && !error && (
        <p className="text-[10px] text-muted-foreground text-center max-w-[220px] leading-tight">
          Click or drop · JPEG/PNG/WebP · up to 5 MB
          <br />
          <span className="opacity-70">Auto-cropped to a 512×512 square</span>
        </p>
      )}
    </div>
  );
}
