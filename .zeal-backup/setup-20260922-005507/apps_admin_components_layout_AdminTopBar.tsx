"use client";
import { ThemeToggle } from "@zeal/ui";
import { useAdminStore } from "@/lib/store/adminStore";
import { ConnectionBadge } from "@/components/dev/ConnectionBadge";
import { cn } from "@zeal/ui";

export function AdminTopBar() {
  const connectionState = useAdminStore((s) => s.isSocketConnected);
  const profile = useAdminStore((s) => s.profile);

  return (
    <header className="sticky top-0 z-20 bg-[var(--color-surface)]/80 backdrop-blur-sm border-b border-[var(--color-border)]">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        <h1 className="text-base font-semibold text-[var(--color-foreground)]">
          {profile?.role ? profile.role.replace("_", " ") + " Console" : "Console"}
        </h1>
        <div className="flex items-center gap-2">
          <ConnectionBadge />
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full",
              connectionState
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-[var(--color-surface-raised)] text-[var(--color-muted-foreground)]",
            )}
            aria-label={connectionState ? "Realtime connected" : "Realtime offline"}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", connectionState ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
            {connectionState ? "Live" : "Offline"}
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
