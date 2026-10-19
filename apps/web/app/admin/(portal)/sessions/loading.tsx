export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-8 w-48 rounded-lg bg-[var(--color-surface-raised)] animate-pulse" />
      <div className="h-4 w-72 rounded bg-[var(--color-surface-raised)] animate-pulse" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-[var(--color-surface-raised)] animate-pulse" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-[var(--color-surface-raised)] animate-pulse" />
    </div>
  );
}
