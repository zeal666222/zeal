"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// SSR-safe Auth Provider — lazy client init, no prerender crashes.
// ═══════════════════════════════════════════════════════════════════════════════

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { createClient } from "@zeal/database";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [supabase] = useState(() => {
    try { return createClient(); } catch { return null; }
  });

  useEffect(() => {
    if (!supabase) { setIsLoading(false); return; }
    let mounted = true;

    const loadSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (!error) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
        }
      } catch (err) {
        console.warn("[auth] session fetch failed:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, newSession: Session | null) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [supabase]);

  const signOut = async () => { if (supabase) await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
