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
import { Camera, Loader2, X } from "lucide-react";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface Props {
  /** Current avatar URL (full URL or storage key) — used as initial preview. */
  defaultValue?: string | null;
  /** Name of the hidden input to write the uploaded URL into. */
  inputName?: string;
  /** Size of the circular preview (Tailwind classes). */
  size?: "sm" | "md" | "lg";
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
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(defaultValue ?? null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
        const form = new FormData();
        form.append("file", file);
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
    [defaultValue],
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
        className={`relative ${dim.ring} rounded-full overflow-hidden
          bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)]
          ring-2 ring-transparent hover:ring-[var(--color-primary)]/40
          transition-all duration-200 active:scale-95 cursor-pointer
          flex items-center justify-center`}
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

        {/* Upload overlay */}
        <AnimatePresence>
          {uploading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center"
            >
              <Loader2 size={dim.icon} className="animate-spin text-white mb-1" />
              <span className={`${dim.overlay} font-black text-white/90`}>
                {progress}%
              </span>
            </motion.div>
          )}
        </AnimatePresence>

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
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white
              flex items-center justify-center shadow-lg hover:bg-rose-600 transition-colors z-10"
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
    </div>
  );
}
