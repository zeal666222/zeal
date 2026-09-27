"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// AdminCommandMenu — ⌘K / Ctrl+K palette for role-filtered dashboard navigation.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command as CommandIcon, Search } from "lucide-react";
import { CommandPalette, type CommandItem } from "@zeal/ui";
import { useAdminStore, ROLE_LEVEL, type AdminRole } from "@/lib/store/adminStore";
import { NAV } from "./AdminSidebar";

export function AdminCommandMenu() {
  const router = useRouter();
  const role = useAdminStore((s) => s.profile?.role) ?? "VIEWER";
  const [open, setOpen] = useState(false);

  const items = useMemo<CommandItem[]>(() => {
    const visible = NAV.filter((item) => ROLE_LEVEL[role as AdminRole] >= ROLE_LEVEL[item.minRole]);
    return visible.map((item) => ({
      id: item.href,
      label: item.label,
      hint: item.href,
      group: "Navigation",
      icon: item.icon,
      keywords: ["go to", item.href],
      onSelect: () => {
        setOpen(false);
        router.push(item.href);
      },
    }));
  }, [role, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:border-[var(--color-primary)]/40 transition-colors"
        aria-label="Open command palette"
      >
        <Search size={13} />
        <span>Search…</span>
        <kbd className="px-1.5 py-0.5 rounded-md bg-[var(--color-surface-sunken)] border border-[var(--color-border)] font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden p-2 rounded-xl text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-raised)]"
        aria-label="Open command palette"
      >
        <CommandIcon size={16} />
      </button>
      <CommandPalette items={items} open={open} onOpenChange={setOpen} placeholder="Jump to a section…" />
    </>
  );
}
