"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen-app flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-surface-raised border border-border flex items-center justify-center mb-6">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>
      <h1 className="text-2xl font-black text-foreground mb-2">You are offline</h1>
      <p className="text-sm text-muted-foreground max-w-sm mb-8">
        Check your internet connection and try again. Your cached pages will still work.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white font-bold text-sm active:scale-95 transition-all"
      >
        Try again
      </button>
    </div>
  );
}
