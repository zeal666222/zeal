"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "./utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

type Side = "left" | "right" | "top" | "bottom";

const SIDE_CLASSES: Record<Side, string> = {
  left:  "inset-y-0 left-0 h-full w-72 max-w-[80vw] border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
  right: "inset-y-0 right-0 h-full w-72 max-w-[80vw] border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
  top:   "inset-x-0 top-0 w-full h-auto max-h-[80vh] border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
  bottom:"inset-x-0 bottom-0 w-full h-auto max-h-[80vh] border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
};

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: Side;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, children, side = "right", ...props }, ref) => (
  <SheetPortal>
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50",
        "bg-[var(--color-surface-overlay)]/70 backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      )}
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 gap-4 p-6 shadow-xl",
        "bg-[var(--color-surface)] border-[var(--color-border)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:duration-200 data-[state=open]:duration-300",
        SIDE_CLASSES[side],
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className={cn(
          "absolute right-4 top-4 p-1.5 rounded-lg",
          "text-[var(--color-muted-foreground)]",
          "hover:bg-[var(--color-surface-raised)]",
        )}
      >
        <X size={16} />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = "SheetContent";

export { Sheet, SheetTrigger, SheetContent, SheetClose, SheetPortal };
