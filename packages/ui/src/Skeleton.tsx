import { cn } from "./utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-slate-200 dark:bg-slate-800",
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

/** Shimmer variant — premium gradient sweep instead of basic pulse */
export function ShimmerSkeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("shimmer rounded-md", className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export function ShimmerCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--color-border)] p-4 space-y-3",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <ShimmerSkeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <ShimmerSkeleton className="h-4 w-1/3" />
          <ShimmerSkeleton className="h-3 w-1/4" />
        </div>
      </div>
      <ShimmerSkeleton className="h-4 w-full" />
      <ShimmerSkeleton className="h-4 w-4/5" />
      <ShimmerSkeleton className="h-4 w-3/5" />
    </div>
  );
}

export function ShimmerGrid({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === lines - 1 ? "w-3/5" : "w-full")}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

export function SkeletonGrid({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
