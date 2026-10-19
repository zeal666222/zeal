// apps/admin/components/admin/RoleBadge.tsx
"use client";

import {cn} from "@zeal/ui";

const STYLE: Record<string, string> = {
  SUPER_ADMIN:  "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30",
  ADMIN:        "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30",
  SUPPORT:      "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30",
  VIEWER:       "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30",
  CLIENT_ADMIN: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
  USER:         "bg-surface-raised text-muted-foreground border-border",
};

export function RoleBadge({ role, className }: { role: string; className?: string }) {
  return (
    <span className={cn(
      "inline-block text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md border",
      STYLE[role] ?? STYLE.USER,
      className,
    )}>
      {role.replace(/_/g, " ")}
    </span>
  );
}
