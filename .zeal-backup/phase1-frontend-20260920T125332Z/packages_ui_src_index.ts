// ═══════════════════════════════════════════════════════════════════════════════
// @zeal/ui — public barrel
// ═══════════════════════════════════════════════════════════════════════════════
// Every export here is reachable via `import { X } from "@zeal/ui"`.
// Subpath exports (motion, a11y, skeleton, tokens.css) are declared in
// package.json and resolve independently.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Utilities ────────────────────────────────────────────────────────────
export { cn } from "./utils";

// ─── Primitives ───────────────────────────────────────────────────────────
export { Button, buttonVariants, type ButtonProps } from "./Button";
export { Card, CardHeader, CardTitle, CardContent } from "./Card";
export { Input, type InputProps } from "./Input";
export { Avatar, AvatarImage, AvatarFallback } from "./Avatar";
export { Badge, badgeVariants, type BadgeProps } from "./Badge";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";

// ─── Loading states ───────────────────────────────────────────────────────
export { Skeleton, SkeletonText, SkeletonCard, SkeletonGrid } from "./Skeleton";

// ─── Accessibility ────────────────────────────────────────────────────────
export { VisuallyHidden, LiveRegion, SkipLink } from "./a11y";

// ─── Motion (lightweight wrappers) ────────────────────────────────────────
// Consumers importing { MotionDiv } from "@zeal/ui" also work, but for
// tree-shaking prefer: import { MotionDiv } from "@zeal/ui/motion";
export {
  MotionProvider,
  AnimatePresence,
  MotionDiv,
  MotionSpan,
  MotionButton,
  MotionSection,
  MotionArticle,
  MotionHeader,
  MotionFooter,
  MotionMain,
  MotionNav,
  MotionA,
  MotionLi,
  MotionUl,
  MotionP,
  MotionH1,
  MotionH2,
  MotionH3,
  MotionImg,
  MotionForm,
} from "./motion";
