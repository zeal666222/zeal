"use client";
// ZEAL_FIX_FE_CATALOG_HOOK
// React-Query wrapper around the service catalog with a 5-minute stale time.
import { useQuery } from "@tanstack/react-query";

interface CatalogService { id: string; name: string; slug: string; parent_category: string; }
interface CatalogGroup { categoryId: string; categoryName: string; sortOrder: number; services: CatalogService[]; }

export function useServiceCatalog() {
  return useQuery<{ groups: CatalogGroup[] }>({
    queryKey: ["catalog", "services"],
    queryFn: async () => {
      const res = await fetch("/api/consultants/service-catalog", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
