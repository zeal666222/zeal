'use client';
import { ConsultantCategory } from '@zeal/types';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const categories = [
  { id: null, label: 'All', icon: 'All' },
  { id: 'ASTROLOGER', label: 'Astrologers', icon: '⭐' },
  { id: 'PSYCHOLOGIST', label: 'Psychologists', icon: '🧠' },
  { id: 'TAROT', label: 'Tarot Readers', icon: '🔮' },
  { id: 'NUMEROLOGIST', label: 'Numerologists', icon: '🔢' },
  { id: 'PALMIST', label: 'Palmists', icon: '🖐️' },
  { id: 'VASTU', label: 'Vastu Experts', icon: '🏠' },
  { id: 'REIKI', label: 'Reiki Masters', icon: '✨' },
  { id: 'LIFE_COACH', label: 'Life Coaches', icon: '🎯' },
  { id: 'HEALER', label: 'Healers', icon: '💫' },
  { id: 'MOTIVATIONAL_SPEAKER', label: 'Motivational Speakers', icon: '🎤' },
  { id: 'SPIRITUAL_GUIDE', label: 'Spiritual Guides', icon: '🕊️' },
  { id: 'YOGA_INSTRUCTOR', label: 'Yoga Instructors', icon: '🧘' },
];

interface CategoryPillsProps {
  activeCategory: string | null;
  onSelect: (category: string | null) => void;
}

export function CategoryPills({ activeCategory, onSelect }: CategoryPillsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto py-2 scrollbar-hide">
      {categories.map((cat) => (
        <motion.button
          key={cat.id || 'all'}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(cat.id)}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1',
            activeCategory === cat.id ? 'bg-[#9D7DC5] text-white shadow-md' : 'bg-[#F4E8F7] dark:bg-gray-800 text-[#5E4B8B] dark:text-white hover:bg-[#E1C5E7] dark:hover:bg-gray-700'
          )}
        >
          {cat.id === null ? (
            'All'
          ) : (
            <>
              <span>{cat.icon}</span>
              {cat.label}
            </>
          )}
        </motion.button>
      ))}
    </div>
  );
}
