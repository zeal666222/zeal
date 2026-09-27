'use client';
import {motion} from 'framer-motion';
import { type LucideIcon } from "lucide-react";

interface EmptyStateProps {
 icon: LucideIcon;
 title: string;
 description: string;
 action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
 return (
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center"
 >
 <div className="p-4 rounded-full bg-[var(--color-surface-sunken)] mb-4">
 <Icon className="w-8 h-8 text-[var(--color-subtle-foreground)] dark:text-gray-500" />
 </div>
 <h3 className="text-lg font-semibold text-muted-foreground">{title}</h3>
 <p className="text-sm text-[var(--color-subtle-foreground)] dark:text-gray-400 mt-1 max-w-md">{description}</p>
 {action && <div className="mt-4">{action}</div>}
 </motion.div>
 );
}
