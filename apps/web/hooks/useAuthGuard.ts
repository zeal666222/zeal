"use client";
// Shared auth guard — returns a function that checks auth before executing an action.
// If not authenticated, shows a toast and redirects to login with the current path as redirect.
import { useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAppStoreShallow } from "@/lib/store/appStore";
import { toast } from "@/components/ui/toaster";

export function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAppStoreShallow((s) => s.isAuthenticated);

  const guard = useCallback(
    (action: () => void | Promise<void>) => {
      if (!isAuthenticated) {
        toast({
          title: "Please log in first",
          description: "You need to be signed in to do that.",
          variant: "default",
        });
        router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }
      void action();
    },
    [isAuthenticated, router, pathname],
  );

  return { isAuthenticated, guard };
}
