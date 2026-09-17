'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Badge } from '@zeal/ui';

interface ServiceCardProps {
  id: string;
  name: string;
  icon: string;
  description: string;
  route: string;
  isFree: boolean;
  tag?: string;
}

export function ServiceCard({ id, name, icon, description, route, isFree, tag }: ServiceCardProps) {
  return (
    <Link href={route} className="block h-full">
      <motion.div
        whileHover={{ y: -6, scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="glass-card-3d h-full text-center flex flex-col items-center justify-center min-h-[120px] sm:min-h-[140px] hover:shadow-2xl transition-all duration-300 p-3 sm:p-4"
      >
        <div className="text-3xl sm:text-4xl mb-1">{icon}</div>
        <h3 className="font-semibold text-[#5E4B8B] dark:text-white text-xs sm:text-sm">{name}</h3>
        <p className="text-[10px] sm:text-xs text-[#B8A1D9] dark:text-gray-400 mt-0.5">{description}</p>
        <div className="mt-1.5 flex items-center justify-center gap-1">
          {isFree && (
            <Badge variant="success" className="text-[8px] sm:text-[10px] px-1.5 py-0.5 bg-gradient-to-r from-green-400/20 to-green-500/20 border-green-500/30">
              Free
            </Badge>
          )}
          {tag && (
            <Badge variant="outline" className="text-[8px] sm:text-[10px] px-1.5 py-0.5 border-[#9D7DC5]/30 text-[#9D7DC5]">
              {tag}
            </Badge>
          )}
        </div>
      </motion.div>
    </Link>
  );
}
