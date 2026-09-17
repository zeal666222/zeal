"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { signInWithGoogle } from "@/lib/auth/oauth";
import { Button } from "@zeal/ui";
import { Mail, Lock, ArrowRight, Sparkles, Shield } from "lucide-react";

export const dynamic = "force-dynamic";

// Fallback in case env var is missing at build time
const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || "/admin";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      await signInWithGoogle({ redirectTo: redirect });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign in failed");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#533AFD] via-[#7A5A9E] to-[#533AFD] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 180, damping: 22 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-8 h-8 text-white" />
            <span className="text-3xl font-bold text-white drop-shadow-lg">Zeal</span>
          </div>
          <p className="text-white/70 text-sm">Sign in to continue your journey</p>
        </div>

        <div className="rounded-3xl p-6 md:p-8 backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl bg-white/10 border border-white/20 px-10 py-3 text-white placeholder:text-white/50 focus:ring-2 focus:ring-[#9D7DC5] outline-none transition-all"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-white/10 border border-white/20 px-10 py-3 text-white placeholder:text-white/50 focus:ring-2 focus:ring-[#9D7DC5] outline-none transition-all"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-300 bg-red-500/15 p-3 rounded-xl border border-red-500/30"
              >
                {error}
              </motion.div>
            )}

            <Button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-3 bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Signing in...</>
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-white/20"></div>
              <span className="flex-shrink mx-4 text-xs text-white/50">or</span>
              <div className="flex-grow border-t border-white/20"></div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full py-3 bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all flex items-center justify-center gap-2"
              onClick={handleGoogleLogin}
              disabled={loading || googleLoading}
            >
              {googleLoading ? (
                <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Connecting...</>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#EA4335" d="M5.26620003,9.76452941 C6.19878754,6.93863203 8.85444915,4.90909091 12,4.90909091 C13.6909091,4.90909091 15.2181818,5.50909091 16.4181818,6.49090909 L19.9090909,3 C17.7818182,1.14545455 15.0545455,0 12,0 C7.27006974,0 3.1977497,2.69829785 1.23999023,6.65002441 L5.26620003,9.76452941 Z" />
                    <path fill="#34A853" d="M5.76909889,17.7516544 C4.54739364,16.3187809 3.81818182,14.5454545 3.81818182,12.5 C3.81818182,11.4181818 4.03636364,10.3818182 4.43636364,9.41818182 L0.282,6.676 C0.101,8.094 0,9.545 0,12 C0,14.636 0.509,17.191 1.418,19.527 L5.76909889,17.7516544 Z" />
                    <path fill="#FBBC05" d="M12,23.7272727 C15.0545455,23.7272727 17.8545455,22.6272727 19.8909091,20.8727273 L16.0636364,17.5818182 C14.9454545,18.4181818 13.5454545,18.9090909 12,18.9090909 C8.85444915,18.9090909 6.19878754,16.8795483 5.26620003,14.0536509 L1.23999023,17.1661566 C3.1977497,21.1218825 7.27006974,23.7272727 12,23.7272727 Z" />
                    <path fill="#4285F4" d="M23.7272727,12 C23.7272727,11.1363636 23.6363636,10.3181818 23.4363636,9.5 L12,9.5 L12,14.5 L18.5,14.5 C18.2727273,15.8636364 17.6818182,17.0454545 16.4909091,17.8818182 L19.7818182,20.8181818 C22.1636364,18.6818182 23.7272727,15.6818182 23.7272727,12 Z" />
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>
          </form>

          <div className="text-center text-sm text-white/60 mt-5">
            Don&apos;t have an account?{" "}
            <Link href="/auth/register" className="text-[#9D7DC5] hover:underline font-medium">
              Sign up
            </Link>
          </div>
        </div>

        {/* Admin Portal Button – with hardcoded fallback */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-center"
        >
          <Link
            href={ADMIN_URL}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 hover:text-white text-sm font-medium transition-all"
          >
            <Shield className="w-4 h-4" />
            Admin Portal
          </Link>
          <p className="text-xs text-white/40 mt-2">For platform administrators only</p>
        </motion.div>
      </motion.div>
    </div>
  );
}
