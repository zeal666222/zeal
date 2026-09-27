import Link from "next/link";
import { Clock } from "lucide-react";

export default function PendingPage() {
 return (
 <div className="max-w-md mx-auto py-12 text-center px-4">
 <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
 <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
 </div>
 <h1 className="text-2xl font-bold text-muted-foreground mb-2">Application Received</h1>
 <p className="text-[var(--color-subtle-foreground)] dark:text-gray-400 mb-6">
 Our team will review your application within 24 hours. You will receive an email once verified.
 </p>
 <Link href="/dashboard" className="inline-block px-6 py-3 rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white font-medium">
 Back to Dashboard
 </Link>
 </div>
 );
}

