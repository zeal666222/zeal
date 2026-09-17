'use client';
import { motion } from 'framer-motion';
import { Search, ArrowRight } from 'lucide-react';
import { Button, Input } from '@zeal/ui';
import { useState } from 'react';

export function HeroSection() {
  const [search, setSearch] = useState('');

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#533AFD] via-[#9D7DC5] to-[#533AFD] p-8 md:p-12 text-white">
      <div className="relative z-10 max-w-2xl">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-3xl md:text-5xl font-bold leading-tight"
        >
          Your Path to Wellness
          <span className="block text-purple-200">Across All Faiths</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mt-2 text-purple-100 text-lg"
        >
          Connect with trusted healers, astrologers, and wellness experts.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-6 flex flex-col sm:flex-row gap-3"
        >
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search consultants, services..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/70"
            />
          </div>
          <Button variant="secondary" className="bg-white text-[#533AFD] hover:bg-white/90">
            Explore <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </motion.div>
      </div>
      {/* Decorative blobs */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
    </section>
  );
}
