"use client";
import {motion} from "framer-motion";
import { useRouter } from "next/navigation";
import {useAppStore} from "@/lib/store/appStore";
import {ZealChat} from "@/components/zeal/ZealChat";
import {CategoryAccordion} from "@/components/zeal/CategoryAccordion";
import { Brain, Briefcase, Heart, Leaf, Sparkles, Star, Users } from "lucide-react";

const featuredCategories = [
 { icon: Sparkles, label: "Astrology", color: "from-purple-400 to-pink-400" },
 { icon: Brain, label: "Therapy", color: "from-blue-400 to-cyan-400" },
 { icon: Heart, label: "Wellness", color: "from-green-400 to-emerald-400" },
 { icon: Star, label: "Tarot", color: "from-yellow-400 to-orange-400" },
 { icon: Users, label: "Coaching", color: "from-indigo-400 to-purple-400" },
 { icon: Leaf, label: "Healing", color: "from-teal-400 to-green-400" },
];

export default function ZealHubClient() {
 const router = useRouter();
 const { user } = useAppStore();
 return (
 <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
 <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-primary)]/20 via-[var(--color-primary-hover)]/10 to-[var(--color-primary)]/20 p-6 md:p-8">
 <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]" />
 <div className="relative z-10">
 <div className="flex items-center gap-2 mb-3">
 <span className="px-3 py-1 text-xs font-medium rounded-full bg-white/20 text-muted-foreground backdrop-blur-sm">✨ AI-Powered Wellness</span>
 </div>
 <h1 className="text-2xl md:text-3xl font-bold text-muted-foreground">
 Welcome to <span className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] bg-clip-text text-transparent">Zeal Hub</span>
 </h1>
 <p className="text-[var(--color-subtle-foreground)] dark:text-gray-400 mt-1 text-sm md:text-base">
 {user ? `👋 Hi ${user.name || "there"}! How can I help you today?` : "✨ Your wellness journey starts here."}
 </p>
 </div>
 <div className="flex flex-wrap gap-2 mt-4 relative z-10">
 {featuredCategories.map((cat, idx) => (
 <button type="button" key={idx} className={`text-xs px-3 py-1.5 rounded-full bg-gradient-to-r ${cat.color} text-white font-medium shadow-sm hover:scale-105 transition-transform cursor-pointer`} onClick={() => router.push(`/explore?category=${cat.label.toLowerCase()}`)} aria-label="Browse category">
 <cat.icon className="w-3 h-3 inline mr-1" />{cat.label}
 </button>
 ))}
 </div>
 <div className="mt-6"><ZealChat /></div>
 </motion.div>

 <section>
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-xl font-bold text-muted-foreground">🌟 Explore All 37+ Categories</h2>
 <span className="text-sm text-[var(--color-subtle-foreground)]">Click to expand</span>
 </div>
 <CategoryAccordion />
 </section>

 <section className="text-center text-xs text-[var(--color-subtle-foreground)] dark:text-gray-500 border-t border-border pt-6 mt-4">
 <p>
 Zeal connects you with trusted experts across 37+ categories: Astrology, Tarot, Numerology, Palmistry, Psychic Mediumship, Clairvoyance, Dream Analysis, Angel & Spirit Guides, Aura Reading, Cartomancy, Past Life Regression, Shadow Work, Mental Health Therapy, Psychiatry, Life Coaching, Wellness Coaching, Energy Healing, Reiki, Professional Advice, Spiritual Commerce, Sound Healing, Yoga, Meditation, Hypnotherapy, Feng Shui, Vastu, Pet Psychic, Oracle Divination, Face Reading, Business Coaching, Health Coaching, Relationship Coaching, Spiritual Coaching, Functional Medicine, Tantra, Aromatherapy, Naturopathy, Acupuncture, Chiropractic, and Massage Therapy.
 </p>
 <p className="mt-2">© 2025 Zeal – Your Wellness Command Center. All rights reserved.</p>
 </section>
 </div>
 );
}

// ZEAL_HUB_COMPLETE_APPLIED
