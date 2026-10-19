export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-8 w-48 rounded-lg bg-[var(--color-surface-raised)] animate-pulse" />
      <div className="h-4 w-72 rounded bg-[var(--color-surface-raised)] animate-pulse" />
            <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden">
        <div className="h-12 bg-[var(--color-surface-raised)]" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 border-t border-[var(--color-border)] bg-[var(--color-surface)] animate-pulse" />
        ))}
      </div>
    </div>
  );
}
