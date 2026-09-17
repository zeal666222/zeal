"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { Button } from "@zeal/ui";

interface Slide { id: string; title: string; subtitle: string; ctaText: string; ctaLink: string; posterUrl?: string; }
interface HeroSliderProps { slides: Slide[]; autoplayInterval?: number; }

export function HeroSlider({ slides, autoplayInterval = 6000 }: HeroSliderProps) {
  const router = useRouter();
  const safeSlides = slides && slides.length > 0 ? slides : null;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const pauseButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!safeSlides || isPaused) return;
    const timer = setInterval(() => setCurrentIndex((p) => (p + 1) % safeSlides.length), autoplayInterval);
    return () => clearInterval(timer);
  }, [safeSlides, autoplayInterval, isPaused]);

  if (!safeSlides) {
    return (
      <div className="relative w-full h-64 md:h-96 rounded-2xl overflow-hidden bg-gradient-to-r from-[#533AFD] to-[#9D7DC5] flex items-center justify-center">
        <p className="text-white text-lg font-medium">Coming soon…</p>
      </div>
    );
  }

  const current = safeSlides[currentIndex % safeSlides.length]!;

  return (
    <div className="relative w-full h-64 md:h-96 rounded-2xl overflow-hidden shadow-2xl group">
      {current.posterUrl && (
        <img src={current.posterUrl} alt={current.title} className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 flex flex-col items-center justify-center text-center text-white p-6"
        >
          <h2 className="text-2xl md:text-4xl font-bold mb-2 drop-shadow-lg">{current.title}</h2>
          <p className="text-sm md:text-lg text-white/90 max-w-md">{current.subtitle}</p>
          <Button
            variant="primary"
            className="mt-6 bg-white text-[#533AFD] hover:bg-white/90"
            onClick={() => { router.push(current.ctaLink); }}
          >
            {current.ctaText}
          </Button>
        </motion.div>
      </AnimatePresence>

      <button onClick={() => setCurrentIndex((p) => (p - 1 + safeSlides.length) % safeSlides.length)} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Previous">
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button onClick={() => setCurrentIndex((p) => (p + 1) % safeSlides.length)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Next">
        <ChevronRight className="w-6 h-6" />
      </button>
      <button ref={pauseButtonRef} onClick={() => setIsPaused(!isPaused)} className="absolute bottom-16 left-3 p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-label={isPaused ? "Play" : "Pause"}>
        {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
      </button>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {safeSlides.map((_, idx) => (
          <button key={idx} onClick={() => setCurrentIndex(idx)} className={"h-1.5 rounded-full transition-all " + (idx === currentIndex ? "w-8 bg-white" : "w-3 bg-white/50 hover:bg-white/80")} aria-label={"Go to slide " + (idx + 1)} />
        ))}
      </div>
    </div>
  );
}

