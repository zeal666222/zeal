"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// Admin Users — dense table, filter pills, inline actions
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Ban, CheckCircle2, Loader2, Search, Shield, Users } from "lucide-react";
import { useChannel, channels, type BroadcastChange } from "@zeal/realtime";

interface UserRow {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  avatar: string | null;
  role: string;
  sparks: number;
  isVerified: boolean;
  is_online: boolean;
  createdAt: string;
}

interface UsersResponse {
  users?: UserRow[];
  pagination?: { page: number; limit: number; total: number; pages: number };
}

type Role = "USER" | "CLIENT_ADMIN" | "SUPPORT" | "ADMIN" | "SUPER_ADMIN" | "VIEWER";

const ROLE_STYLE: Record<string, string> = {
  SUPER_ADMIN:  "bg-rose-500/15 text-rose-500 border-rose-500/30",
  ADMIN:        "bg-purple-500/15 text-purple-500 border-purple-500/30",
  SUPPORT:      "bg-blue-500/15 text-blue-500 border-blue-500/30",
  VIEWER:       "bg-[var(--color-surface-raised)] text-[var(--color-muted-foreground)] border-[var(--color-border)]",
  CLIENT_ADMIN: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  USER:         "bg-[var(--color-surface-raised)] text-[var(--color-muted-foreground)] border-[var(--color-border)]",
};

const ROLES: Role[] = ["USER", "CLIENT_ADMIN", "SUPPORT", "ADMIN", "SUPER_ADMIN", "VIEWER"];

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data, isLoading, error, refetch } = useQuery<UsersResponse>({
    queryKey: ["admin", "users", search, roleFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      const res = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: string }) => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Action failed");
      }
      return res.json();
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["admin", "users"] }); },
  });

  const refresh = useCallback(() => { void refetch(); }, [refetch]);

  useChannel<BroadcastChange>({
    channel: channels.adminBookings(),
    event: "*",
    onMessage: refresh,
  });

  const users = data?.users ?? [];
  const total = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.pages ?? 1;

  const stats = useMemo(() => {
    const byRole = users.reduce<Record<string, number>>((acc, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {});
    return { byRole };
  }, [users]);

  if (isLoading && users.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-rose-500">
        <p>Failed to load users: {(error as Error).message}</p>
        <button onClick={refresh} className="mt-2 text-[var(--color-primary)] hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-[var(--color-foreground)] flex items-center gap-2">
          <Users className="w-6 h-6 text-[var(--color-primary)]" /> Users
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)] mt-1">
          {total.toLocaleString()} account{total !== 1 ? "s" : ""} on the platform
        </p>
      </div>

      {/* Role pills */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(stats.byRole).map(([role, count]) => (
          <span key={role} className={"text-xs font-bold px-3 py-1 rounded-full border " + (ROLE_STYLE[role] || ROLE_STYLE.USER)}>
            {role.replace(/_/g, " ")} · {count}
          </span>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
          <input
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by email, name, or username…"
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-subtle-foreground)] outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setRoleFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-primary)]"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      {/* Table */}
      {users.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-[var(--color-border)] rounded-3xl">
          <Users className="w-12 h-12 text-[var(--color-muted-foreground)] mx-auto mb-4" />
          <p className="text-[var(--color-muted-foreground)]">
            {search || roleFilter ? "No users match your filters" : "No users yet"}
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
        >
          <table className="w-full">
            <thead className="bg-[var(--color-surface-raised)] sticky top-0 z-10">
              <tr>
                <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-[var(--color-muted-foreground)]">User</th>
                <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-[var(--color-muted-foreground)]">Role</th>
                <th className="text-right p-4 text-[10px] font-black uppercase tracking-widest text-[var(--color-muted-foreground)]">Sparks</th>
                <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-[var(--color-muted-foreground)]">Joined</th>
                <th className="text-right p-4 text-[10px] font-black uppercase tracking-widest text-[var(--color-muted-foreground)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[var(--color-surface-raised)] transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] flex items-center justify-center text-[var(--color-primary-foreground)] font-bold text-sm overflow-hidden shrink-0">
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (u.name || u.username || u.email).charAt(0).toUpperCase()
                        )}
                        {u.is_online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[var(--color-surface)] rounded-full" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--color-foreground)] truncate">{u.name || u.username || "—"}</p>
                        <p className="text-xs text-[var(--color-muted-foreground)] truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={"inline-block text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md border " + (ROLE_STYLE[u.role] || ROLE_STYLE.USER)}>
                      {u.role.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="p-4 text-sm font-mono text-orange-500 text-right">
                    {(u.sparks ?? 0).toLocaleString()}
                  </td>
                  <td className="p-4 text-xs text-[var(--color-muted-foreground)]">
                    {new Date(u.createdAt).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {!u.isVerified && (
                        <button
                          onClick={() => actionMutation.mutate({ userId: u.id, action: "VERIFY" })}
                          disabled={actionMutation.isPending}
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 disabled:opacity-50"
                          title="Verify"
                        >
                          <CheckCircle2 size={14} />
                        </button>
                      )}
                      {u.role !== "SUPER_ADMIN" && (
                        <button
                          onClick={() => {
                            if (!confirm(`Promote ${u.email} to ADMIN?`)) return;
                            actionMutation.mutate({ userId: u.id, action: "PROMOTE_ADMIN" });
                          }}
                          disabled={actionMutation.isPending}
                          className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 disabled:opacity-50"
                          title="Promote to ADMIN"
                        >
                          <Shield size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (!confirm(`Ban ${u.email}?`)) return;
                          actionMutation.mutate({ userId: u.id, action: "BAN" });
                        }}
                        disabled={actionMutation.isPending}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 disabled:opacity-50"
                        title="Ban"
                      >
                        <Ban size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-sm text-[var(--color-foreground)] disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-sm text-[var(--color-muted-foreground)]">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-sm text-[var(--color-foreground)] disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
