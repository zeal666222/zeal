import type { Metadata } from "next";
import { SEO } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: SEO.sparks.title,
  description: SEO.sparks.description,
};

export default function SparksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
