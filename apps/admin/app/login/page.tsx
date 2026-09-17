"use client";

import { useState, useEffect, Suspense } from "react";
import { adminLoginAction } from "@/actions/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert, Lock, Mail, Loader2, Server, Timer, Terminal,
  Activity, Wifi, WifiOff, ChevronRight, Fingerprint, AlertTriangle,
} from "lucide-react";

function AdminLoginContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "verifying" | "granted">("idle");
  const [lockSeconds, setLockSeconds] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [time, setTime] = useState(new Date());
  const [online, setOnline] = useState(true);
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    const o = setInterval(() => setOnline(navigator.onLine), 5000);
    return () => { clearInterval(t); clearInterval(o); };
  }, []);

  useEffect(() => {
    const urlError = params.get("error");
    if (urlError === "unauthorized") setError("Access denied — admin clearance required.");
  }, [params]);

  useEffect(() => {
    if (lockSeconds <= 0) return;
    const t = setInterval(() => setLockSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [lockSeconds]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (lockSeconds > 0) return;

    setLoading(true);
    setError("");
    setPhase("verifying");

    const fd = new FormData(e.currentTarget);
    const res = await adminLoginAction(fd);

    if (res.success && res.destination) {
      setPhase("granted");
      setTimeout(() => router.push(res.destination), 800);
    } else {
      const msg = res.error || "Authentication failed.";
      setError(msg);
      if (/lock|too many|rate/i.test(msg)) setLockSeconds(15 * 60);
      setPhase("idle");
      setLoading(false);
    }
  };

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  const locked = lockSeconds > 0;
  const canSubmit = email.length > 0 && password.length > 0 && !locked && !loading;

  return (
    <div className="min-h-screen bg-black flex relative overflow-hidden font-mono">
      {/* Ambient layers */}
      <div className="absolute inset-0 opacity-[0.15] bg-[radial-gradient(ellipse_at_center,rgba(244,63,94,0.4),transparent_50%)]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-rose-600/10 blur-[200px] rounded-full pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-between p-12 border-r border-white/5">
        <div>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3"
          >
            <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
              <Terminal size={20} className="text-rose-500" />
            </div>
            <div>
              <p className="text-[10px] text-rose-500/70 tracking-[0.3em] font-bold uppercase">
                Project Zeal
              </p>
              <p className="text-white text-sm font-black tracking-wider">CORE CONSOLE</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mt-24"
          >
            <h1 className="text-6xl font-black text-white leading-[0.95] tracking-tight">
              God-View
              <br />
              <span className="text-rose-500">Clearance</span>
            </h1>
            <p className="text-zinc-500 text-sm mt-6 max-w-md leading-relaxed">
              Restricted infrastructure node. Every action audited.
              Unauthorized access attempts are logged and reported.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 space-y-3 text-xs"
          >
            <div className="flex items-center gap-3 text-zinc-500">
              <div className={`w-1.5 h-1.5 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              <span className="uppercase tracking-widest">Node Status:</span>
              <span className={online ? "text-emerald-400" : "text-rose-400"}>
                {online ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-zinc-500">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="uppercase tracking-widest">Encryption:</span>
              <span className="text-emerald-400">AES-256-GCM</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-500">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="uppercase tracking-widest">Audit Log:</span>
              <span className="text-emerald-400">ACTIVE</span>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="space-y-2 text-xs text-zinc-600"
        >
          <p>
            <span className="text-zinc-500">TIME:</span>{" "}
            <span className="text-zinc-300 font-mono">{time.toLocaleTimeString("en-GB")}</span>
          </p>
          <p>
            <span className="text-zinc-500">REGION:</span>{" "}
            <span className="text-zinc-300">bom1 / ap-south-1</span>
          </p>
          <p className="pt-3 text-zinc-700">© 2026 ZEAL Core — All access monitored</p>
        </motion.div>
      </div>

      {/* Right auth panel */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-14 h-14 mx-auto bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mb-3">
              <Terminal size={24} className="text-rose-500" />
            </div>
            <p className="text-white text-lg font-black tracking-widest">ZEAL CORE</p>
          </div>

          {/* Console card */}
          <div className="relative">
            {/* Terminal header bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-950 border border-white/5 border-b-0 rounded-t-2xl">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
              </div>
              <span className="ml-3 text-[10px] text-zinc-600 tracking-widest">
                zeal-core · auth.node
              </span>
              <div className="ml-auto flex items-center gap-2 text-[10px] text-zinc-600">
                {online ? <Wifi size={11} /> : <WifiOff size={11} />}
              </div>
            </div>

            <div className="bg-zinc-950/80 backdrop-blur-2xl border border-white/5 rounded-b-2xl p-8 shadow-2xl">
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="text-rose-500" size={16} />
                  <span className="text-[10px] text-rose-500 tracking-[0.2em] font-bold uppercase">
                    Restricted Access Node
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Authorize Session
                </h2>
                <p className="text-xs text-zinc-500 mt-1.5">
                  Admin credentials required for entry
                </p>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-5 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-start gap-2.5"
                  >
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {locked && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-5 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400"
                  >
                    <div className="flex items-center gap-2 mb-1 text-[10px] tracking-[0.2em] font-bold uppercase">
                      <Timer size={12} /> Access Locked
                    </div>
                    <p className="text-2xl font-black font-mono tracking-widest text-amber-300">
                      {formatCountdown(lockSeconds)}
                    </p>
                    <p className="text-[10px] mt-1 text-amber-500/70">
                      Too many failed attempts. Retry after timer.
                    </p>
                  </motion.div>
                )}

                {phase === "granted" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-5 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold text-center"
                  >
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Fingerprint size={14} />
                      <span className="tracking-[0.2em] uppercase">Access Granted</span>
                    </div>
                    <p className="text-[10px] text-emerald-500/70">
                      Routing to command center...
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase mb-2">
                    Identity
                  </label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500/50 text-xs font-mono select-none">
                      $
                    </span>
                    <Mail
                      size={14}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-rose-500 transition-colors"
                    />
                    <input
                      name="email"
                      type="email"
                      required
                      disabled={locked}
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@zeal.com"
                      className="w-full pl-8 pr-11 py-3.5 bg-black border border-white/5 rounded-lg text-sm font-mono text-white placeholder:text-zinc-700 outline-none focus:border-rose-500/50 focus:bg-black transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase mb-2">
                    Passphrase
                  </label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500/50 text-xs font-mono select-none">
                      $
                    </span>
                    <Lock
                      size={14}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-rose-500 transition-colors"
                    />
                    <input
                      name="password"
                      type="password"
                      required
                      disabled={locked}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-8 pr-11 py-3.5 bg-black border border-white/5 rounded-lg text-sm font-mono text-white placeholder:text-zinc-700 outline-none focus:border-rose-500/50 focus:bg-black transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full py-4 mt-3 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-black text-xs tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-[0_0_40px_-10px_rgba(244,63,94,0.5)]"
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>{phase === "verifying" ? "VERIFYING..." : "AUTHORIZING..."}</span>
                    </>
                  ) : locked ? (
                    <>
                      <Timer size={14} />
                      <span>LOCKED</span>
                    </>
                  ) : (
                    <>
                      <Fingerprint size={14} />
                      <span>AUTHORIZE</span>
                      <ChevronRight size={14} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-600 font-mono">
                <span className="flex items-center gap-1.5">
                  <Activity size={10} className="text-emerald-500" />
                  SESSION MONITORED
                </span>
                <span>v2.4.1</span>
              </div>
            </div>
          </div>

          <p className="text-center text-[10px] text-zinc-700 mt-6 font-mono tracking-widest">
            UNAUTHORIZED ACCESS IS PROHIBITED AND LOGGED
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default function AdminLogin() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <Loader2 className="animate-spin text-rose-500" size={32} />
        </div>
      }
    >
      <AdminLoginContent />
    </Suspense>
  );
}
