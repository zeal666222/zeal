import Link from "next/link";
import { Home, Search } from "lucide-react";

export const dynamic = "force-dynamic";

export default function NotFound() {
 return (
 <div className="flex min-h-[70vh] flex-col items-center justify-center p-4 text-center">
 <h1 className="text-6xl font-bold text-[var(--color-primary)] dark:text-[var(--color-primary)] mb-4">404</h1>
 <h2 className="text-2xl font-bold text-muted-foreground mb-2">Page Not Found</h2>
 <p className="text-sm text-[var(--color-subtle-foreground)] dark:text-gray-400 mb-6 max-w-md">
 The page you&apos;re looking for doesn&apos;t exist or has been moved.
 </p>
 <div className="flex gap-3 flex-wrap justify-center">
 <Link
 href="/dashboard"
 className="px-6 py-3 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white rounded-xl font-medium hover:shadow-lg hover:shadow-[var(--color-primary-hover)]/30 transition-all"
 >
 <Home className="w-4 h-4 inline mr-2" /> Go Home
 </Link>
 <Link
 href="/explore"
 className="px-6 py-3 bg-[var(--color-surface-sunken)] text-muted-foreground rounded-xl font-medium hover:bg-[var(--color-primary-muted)] dark:hover:bg-gray-700 transition-all"
 >
 <Search className="w-4 h-4 inline mr-2" /> Explore
 </Link>
 </div>
 </div>
 );
}
