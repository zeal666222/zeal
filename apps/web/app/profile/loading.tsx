export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-[var(--color-surface-raised)] animate-pulse" />
        <div className="space-y-2 flex-1">
          <div className="h-6 w-40 rounded-lg bg-[var(--color-surface-raised)] animate-pulse" />
          <div className="h-4 w-56 rounded bg-[var(--color-surface-sunken)] animate-pulse" />
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-32 rounded-2xl bg-[var(--color-surface-raised)] animate-pulse" />
      ))}
    </div>
  );
}
