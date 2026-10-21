"use client";

import { useMemo, useState } from "react";
import { usePresence, channels } from "@zeal/realtime";
import { Eye, Globe, ShieldCheck } from "lucide-react";
import { cn } from "@zeal/ui";

interface VisitorMeta extends Record<string, unknown> {
  path: string;
  name: string | null;
  avatar: string | null;
  onlineAt: string;
}

interface VisitorRow {
  key: string;
  meta: VisitorMeta;
}

function activityLabel(onlineAt: string): string {
  const secs = Math.floor((Date.now() - new Date(onlineAt).getTime()) / 1000);
  if (secs < 15) return "now";
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

function pathLabel(path: string): string {
  if (path.startsWith("/admin")) return "Admin panel";
  if (path.startsWith("/chat")) return "In a chat";
  if (path.startsWith("/services")) return `Service · ${path.split("/")[2] ?? ""}`;
  if (path.startsWith("/consultant")) return "Viewing a consultant";
  if (path === "/" || path === "") return "Home";
  return path.length > 28 ? `${path.slice(0, 28)}…` : path;
}

// Live site-wide visitor list from the site:presence channel. The observer's
// own auto-tracked entry (no `path`) is filtered out, so the count is exactly
// the humans currently browsing — staff included, flagged by route.
export function ActiveVisitors({ className }: { className?: string }) {
  const [state, setState] = useState<Record<string, VisitorMeta[]>>({});

  usePresence<VisitorMeta>(channels.sitePresence(), `admin-observer-${Math.random().toString(36).slice(2, 8)}`, setState);

  const visitors = useMemo<VisitorRow[]>(() => {
    const rows: VisitorRow[] = [];
    for (const [key, metas] of Object.entries(state)) {
      for (const meta of metas) {
        if (meta?.path) rows.push({ key: `${key}:${meta.onlineAt}`, meta });
      }
    }
    return rows.sort(
      (a, b) => new Date(b.meta.onlineAt).getTime() - new Date(a.meta.onlineAt).getTime(),
    );
  }, [state]);

  const staffCount = visitors.filter((v) => v.meta.path.startsWith("/admin")).length;

  return (
    <div className={cn("glass-card-3d p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
            <Eye size={16} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-foreground">Active Visitors</h3>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
              Realtime presence
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="block text-2xl font-black text-emerald-400 tabular-nums">
            {visitors.length}
          </span>
          {staffCount > 0 && (
            <span className="text-[9px] font-bold text-rose-400">{staffCount} staff</span>
          )}
        </div>
      </div>

      {visitors.length === 0 ? (
        <div className="py-6 text-center">
          <Globe size={20} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">No visitors on the site right now</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin pr-1">
          {visitors.slice(0, 20).map((v) => {
            const isStaff = v.meta.path.startsWith("/admin");
            return (
              <div
                key={v.key}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-raised/40 border border-border/30"
              >
                <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] flex items-center justify-center text-white text-[10px] font-black overflow-hidden shrink-0">
                  {v.meta.avatar
                    ? <img src={v.meta.avatar} alt="" className="w-full h-full object-cover" />
                    : (v.meta.name || "G").charAt(0).toUpperCase()}
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-surface" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-foreground truncate">
                      {v.meta.name || "Guest"}
                    </p>
                    {isStaff && (
                      <span title="In admin panel" className="shrink-0">
                        <ShieldCheck size={11} className="text-rose-400" />
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{pathLabel(v.meta.path)}</p>
                </div>
                <span className="text-[10px] text-emerald-400/80 font-bold shrink-0">
                  {activityLabel(v.meta.onlineAt)}
                </span>
              </div>
            );
          })}
          {visitors.length > 20 && (
            <p className="text-[10px] text-muted-foreground text-center pt-1">
              +{visitors.length - 20} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}
