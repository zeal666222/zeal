// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/ui — public barrel
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Utilities ────────────────────────────────────────────────────────────
export { cn } from "./utils";

// ─── Primitives ───────────────────────────────────────────────────────────
export { Button, buttonVariants, type ButtonProps } from "./Button";
export { Card, CardHeader, CardTitle, CardContent } from "./Card";
export { Input, type InputProps } from "./Input";
export { Textarea, type TextareaProps } from "./textarea";
export { Avatar, AvatarImage, AvatarFallback } from "./Avatar";
export { Badge, badgeVariants, type BadgeProps } from "./Badge";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";
export { Separator } from "./separator";

// ─── Forms ────────────────────────────────────────────────────────────────
export {
  Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem, SelectLabel,
} from "./select";

// ─── Overlays ─────────────────────────────────────────────────────────────
export {
  Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger,
  DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "./dialog";
export { Sheet, SheetTrigger, SheetContent, SheetClose, SheetPortal } from "./sheet";
export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuGroup, DropdownMenuPortal,
} from "./dropdown-menu";
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip";

// ─── Layout ───────────────────────────────────────────────────────────────
export { PageHeader } from "./page-header";
export { EmptyState } from "./empty-state";

// ─── Loading states ───────────────────────────────────────────────────────
export { Skeleton, SkeletonText, SkeletonCard, SkeletonGrid } from "./Skeleton";

// ─── Accessibility ────────────────────────────────────────────────────────
export { VisuallyHidden, LiveRegion, SkipLink } from "./a11y";

// ─── Theme ────────────────────────────────────────────────────────────────
export { ThemeProvider } from "./theme-provider";
export { ThemeToggle } from "./theme-toggle";

// ─── Command palette ──────────────────────────────────────────────────────
export { CommandPalette, type CommandItem } from "./command-palette";

// ─── Motion (also importable via @zeal/ui/motion) ─────────────────────────
export {
  MotionProvider, AnimatePresence,
  MotionDiv, MotionSpan, MotionButton, MotionSection, MotionArticle,
  MotionHeader, MotionFooter, MotionMain, MotionNav, MotionA,
  MotionLi, MotionUl, MotionP, MotionH1, MotionH2, MotionH3, MotionImg, MotionForm,
} from "./motion";
