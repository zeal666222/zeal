"use client";
import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  onConfirm,
}: Props) {
  const [busy, setBusy] = React.useState(false);
  const pending = loading || busy;

  const handle = async () => {
    if (pending) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-foreground)] hover:border-[var(--color-primary)]/40 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handle}
            disabled={pending}
            className={
              "px-4 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-2 disabled:opacity-50 " +
              (destructive
                ? "bg-[var(--color-destructive)] hover:opacity-90"
                : "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] hover:opacity-95")
            }
          >
            {pending && <Loader2 size={13} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
