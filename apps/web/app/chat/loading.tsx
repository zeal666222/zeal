export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-8 w-48 rounded-lg bg-[var(--color-surface-raised)] animate-pulse" />
      <div className="h-4 w-72 rounded bg-[var(--color-surface-raised)] animate-pulse" />
            <div className="space-y-4 max-w-3xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 rounded-2xl bg-[var(--color-surface-raised)] animate-pulse" />
        ))}
      </div>
    </div>
  );
}
