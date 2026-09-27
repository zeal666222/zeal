'use client';
import {motion} from 'framer-motion';

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px]">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 bg-[var(--color-primary)] rounded-full animate-bounce" />
        <span className="w-2.5 h-2.5 bg-[var(--color-primary)] rounded-full animate-bounce [animation-delay:0.2s]" />
        <span className="w-2.5 h-2.5 bg-[var(--color-primary)] rounded-full animate-bounce [animation-delay:0.4s]" />
      </div>
      <p className="mt-3 text-sm text-[var(--color-subtle-foreground)] dark:text-gray-400">Loading...</p>
    </div>
  );
}
