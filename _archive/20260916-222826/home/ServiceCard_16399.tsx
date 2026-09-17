'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ServiceCardProps {
  id: string;
  name: string;
  icon: string;
  description: string;
  isFree: boolean;
  route: string;
  isAIPowered?: boolean;
}

export function ServiceCard({
  id,
  name,
  icon,
  description,
  isFree,
  route,
  isAIPowered = false,
}: ServiceCardProps) {
  return (
    <Link href={route} className="block h-full">
      <motion.div
        whileHover={{ scale: 1.02, y: -4 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="bg-white dark:bg-gray-900 rounded-xl border border-[#E1C5E7] dark:border-gray-700 p-4 text-center h-full shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="text-3xl mb-2">{icon}</div>
        <h3 className="font-semibold text-[#5E4B8B] dark:text-white text-sm">{name}</h3>
        <p className="text-xs text-[#B8A1D9] dark:text-gray-400 mt-1">{description}</p>
        <div className="mt-2 flex items-center justify-center gap-1">
          {isFree && (
            <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
              Free
            </span>
          )}
          {isAIPowered && (
            <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full">
              AI
            </span>
          )}
        </div>
      </motion.div>
    </Link>
  );
}
