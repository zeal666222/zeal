"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useAppStore, type User as StoreUser, type Wallet } from "@/lib/store/appStore";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isLoading: true,
  isConfigured: false,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function SupabaseAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .catch((err: unknown) => {
        console.warn("[auth] getSession failed:", err);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, next: Session | null) => {
        if (!mounted) return;
        setSession(next);
        setUser(next?.user ?? null);
        setIsLoading(false);
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // ─── Hydrate Zustand store ──────────────────────────────────────────────
  // Two-phase but STRICTLY per user id. Seeding from JWT `user_metadata`
  // every time the effect fires (which Supabase does on TOKEN_REFRESHED
  // every hour) would revert the header avatar to the signup-time value
  // after any successful profile upload, because profile writes update
  // public."User" only. We therefore:
  //   • seed once from JWT the first time we see a given user id (instant
  //     paint with no DB round trip),
  //   • then overlay DB-authoritative values from /api/users/me/profile,
  //   • on subsequent auth events for the SAME user we leave the store
  //     alone — the RealtimeProvider channel pushes any real change.
  const setStoreUser = useAppStore((s) => s.setUser);
  const updateUser = useAppStore((s) => s.updateUser);
  const setStoreWallet = useAppStore((s) => s.setWallet);
  const hydratedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      hydratedForRef.current = null;
      setStoreUser(null);
      setStoreWallet(null);
      return;
    }

    // Already fully or partially hydrated for this user id — skip.
    if (hydratedForRef.current === user.id) return;
    hydratedForRef.current = user.id;

    // Phase 1: seed from JWT for an instant first paint.
    setStoreUser({
      id: user.id,
      email: user.email ?? "",
      username: (user.user_metadata?.username as string) ?? user.email?.split("@")[0] ?? "",
      name: (user.user_metadata?.full_name as string) ?? (user.user_metadata?.name as string) ?? null,
      avatar: (user.user_metadata?.avatar_url as string) ?? null,
      bio: null,
      sparks: 0,
      role: "USER",
      isVerified: false,
    });

    // Phase 2: authoritative profile from DB.
    (async () => {
      try {
        const res = await fetch("/api/users/me/profile", { cache: "no-store", credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          user?: Partial<StoreUser> & { id?: string };
          wallet?: Partial<Wallet> & { id?: string; userId?: string };
        };
        const u = data.user;
        if (u && u.id === user.id) {
          updateUser({
            username: u.username ?? (user.user_metadata?.username as string) ?? user.email?.split("@")[0] ?? "",
            name: u.name ?? (user.user_metadata?.full_name as string) ?? null,
            avatar: u.avatar ?? (user.user_metadata?.avatar_url as string) ?? null,
            bio: u.bio ?? null,
            sparks: typeof u.sparks === "number" ? u.sparks : 0,
            role: (u.role as StoreUser["role"]) ?? "USER",
            isVerified: Boolean(u.isVerified),
          });
          // Reflect the DB truth back into the JWT metadata so any future
          // hydration (this tab or another) picks up the current avatar
          // rather than the signup-time one. Best-effort, fire-and-forget.
          const metaAvatar = (u.avatar as string | null | undefined) ?? null;
          const metaName = (u.name as string | null | undefined) ?? null;
          const metaUser = (u.username as string | null | undefined) ?? null;
          const currentMeta = user.user_metadata ?? {};
          const drifted =
            (currentMeta.avatar_url ?? null) !== metaAvatar ||
            (currentMeta.full_name ?? currentMeta.name ?? null) !== metaName ||
            (currentMeta.username ?? null) !== metaUser;
          if (drifted && supabase) {
            void supabase.auth.updateUser({
              data: {
                ...currentMeta,
                avatar_url: metaAvatar,
                full_name: metaName,
                username: metaUser,
              },
            }).catch(() => { /* non-fatal — realtime keeps us correct */ });
          }
        }
        const w = data.wallet;
        if (w && typeof w.balance === "number") {
          setStoreWallet({
            id: w.id ?? `wallet-${user.id}`,
            userId: user.id,
            balance: w.balance ?? 0,
            escrow: w.escrow ?? 0,
            pendingIn: w.pendingIn ?? 0,
            pendingOut: w.pendingOut ?? 0,
            blocked: w.blocked ?? 0,
          });
        }
      } catch {
        // Network blip — allow a future auth event to retry hydration.
        hydratedForRef.current = null;
      }
    })();
  }, [user, isLoading, setStoreUser, setStoreWallet, updateUser, supabase]);

  const value: AuthContextValue = useMemo(
    () => ({
      user,
      session,
      isLoading,
      isConfigured: Boolean(supabase),
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
      },
    }),
    [user, session, isLoading, supabase],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
