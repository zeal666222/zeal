"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store/appStore";

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

  // ─── Hydrate Zustand store (consultant/feed/chat CTA all read from it) ─
  const setStoreUser = useAppStore((s) => s.setUser);
  useEffect(() => {
    if (isLoading) return;
    if (user) {
      setStoreUser({
        id: user.id,
        email: user.email ?? "",
        username: (user.user_metadata?.username as string) ?? user.email?.split("@")[0] ?? "",
        name: (user.user_metadata?.full_name as string) ?? (user.user_metadata?.name as string) ?? null,
        avatar: (user.user_metadata?.avatar_url as string) ?? null,
        bio: null, sparks: 0, role: "USER", isVerified: false,
      });
    } else {
      setStoreUser(null);
    }
  }, [user, isLoading, setStoreUser]);

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
