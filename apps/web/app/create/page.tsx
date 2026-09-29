"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Create Post — with post limit UI + image upload
// ═══════════════════════════════════════════════════════════════════════════════

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertCircle, ArrowLeft, ImageIcon, Loader2, Send, Sparkles, Upload, X,
} from "lucide-react";
import { createPostAction, type PostActionState } from "@/actions/profile";
import { toast } from "@/components/ui/toaster";

interface LimitInfo {
  canPost: boolean;
  limit: number;
  current: number;
  remaining: number;
}

export default function CreatePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [locationTag, setLocationTag] = useState("");
  const [limit, setLimit] = useState<LimitInfo | null>(null);
  const [loadingLimit, setLoadingLimit] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] = useActionState<PostActionState | null, FormData>(
    createPostAction,
    null,
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/users/me/profile", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { canPost: LimitInfo };
          setLimit(data.canPost);
        }
      } finally {
        setLoadingLimit(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (state?.ok) {
      toast({ title: "Post published", variant: "success" });
      setTimeout(() => router.push("/profile"), 900);
    }
  }, [state, router]);

  const uploadImage = async (f: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append("file", f);
    fd.append("folder", "posts");
    setUploading(true);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        toast({ title: "Image upload failed", variant: "destructive" });
        return null;
      }
      const data = (await res.json()) as { url?: string; key?: string };
      return data.key ?? data.url ?? null;
    } catch {
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!caption.trim() && !file) {
      toast({ title: "Add a caption or photo", variant: "destructive" });
      return;
    }
    let urls = mediaUrls;
    if (file && urls.length === 0) {
      const url = await uploadImage(file);
      if (url) {
        urls = [url];
        setMediaUrls(urls);
      }
    }
    const fd = new FormData();
    fd.append("content", caption.trim());
    if (urls.length > 0) fd.append("mediaUrls", JSON.stringify(urls));
    if (locationTag.trim()) fd.append("locationTag", locationTag.trim());
    formAction(fd);
  };

  if (loadingLimit) {
    return (
      <div className="min-h-screen-app bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  const isBlocked = limit && !limit.canPost;

  return (
    <div className="min-h-screen-app bg-background pb-24">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-surface-raised"
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-sm font-black text-foreground">New post</h1>
          <div className="w-8" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6">
        {isBlocked && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20
                       text-amber-400 text-xs font-bold flex items-start gap-2"
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>
              You&apos;ve reached your post limit ({limit?.limit}). Delete a post
              from your profile to create a new one.
            </span>
          </motion.div>
        )}

        {!isBlocked && limit && (
          <div className="mb-6 p-3 rounded-2xl bg-surface border border-border
                          text-xs text-muted-foreground flex items-center gap-2">
            <Sparkles size={12} className="text-[var(--color-luxury-gold)]" />
            <span>
              {limit.remaining} of {limit.limit} posts remaining
            </span>
          </div>
        )}

        {state && !state.ok && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20
                          text-rose-400 text-xs font-bold">
            {state.error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div
            onClick={() => !isBlocked && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-8 text-center transition-colors
              ${isBlocked ? "border-border opacity-50 cursor-not-allowed"
                          : "border-border hover:border-[var(--color-primary)] cursor-pointer"}`}
          >
            {file && previewUrl ? (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-96 mx-auto rounded-2xl object-contain"
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setMediaUrls([]); }}
                  className="absolute top-2 right-2 p-2 bg-black/60 rounded-full
                             text-white hover:bg-black/80"
                  aria-label="Remove image"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="py-8">
                <ImageIcon size={40} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-foreground font-bold mb-1">
                  Tap to upload a photo
                </p>
                <p className="text-[10px] text-muted-foreground">
                  JPG, PNG, WEBP · Max 5 MB
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setFile(f); setMediaUrls([]); }
              }}
              className="hidden"
            />
          </div>

          <div>
            <label htmlFor="caption" className="block text-[10px] font-black
                       text-muted-foreground uppercase tracking-widest mb-2">
              Caption
            </label>
            <textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption…"
              rows={4}
              maxLength={2200}
              className="w-full px-4 py-3.5 bg-surface border border-border rounded-2xl
                         text-sm text-foreground resize-none
                         placeholder:text-muted-foreground
                         outline-none focus:border-[var(--color-primary)] transition-colors"
            />
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {caption.length} / 2200
            </p>
          </div>

          <div>
            <label htmlFor="locationTag" className="block text-[10px] font-black
                       text-muted-foreground uppercase tracking-widest mb-2">
              Location (optional)
            </label>
            <input
              id="locationTag"
              type="text"
              value={locationTag}
              onChange={(e) => setLocationTag(e.target.value)}
              placeholder="Mumbai, India"
              maxLength={100}
              className="w-full px-4 py-3.5 bg-surface border border-border rounded-2xl
                         text-sm text-foreground placeholder:text-muted-foreground
                         outline-none focus:border-[var(--color-primary)] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isBlocked || isPending || uploading || (!caption.trim() && !file)}
            className="w-full py-4 rounded-2xl
                       bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)]
                       text-white font-black text-sm
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            {uploading || isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Publishing…</>
            ) : (
              <><Send size={16} /> Publish</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
