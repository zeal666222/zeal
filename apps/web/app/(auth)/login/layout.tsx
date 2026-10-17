import type { Metadata } from "next";
import { SEO } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: SEO.login.title,
  description: SEO.login.description,
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
