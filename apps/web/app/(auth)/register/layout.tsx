import type { Metadata } from "next";
import { SEO } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: SEO.register.title,
  description: SEO.register.description,
  robots: { index: false, follow: false },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
