'use client';
import { ConsultantCard } from '@/components/shared/ConsultantCard';
import { ConsultantProfile } from '@zeal/types';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ConsultantCarouselProps {
  consultants: ConsultantProfile[];
  title?: string;
  seeAllLink?: string;
}

export function ConsultantCarousel({ consultants, title, seeAllLink }: ConsultantCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', dragFree: true });

  if (!consultants.length) return null;

  return (
    <div className="relative">
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-[#5E4B8B] dark:text-white">{title}</h2>
          {seeAllLink && (
            <a href={seeAllLink} className="text-sm text-[#9D7DC5] hover:underline">See All</a>
          )}
        </div>
      )}
      <div className="relative">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-4">
            {consultants.map((consultant) => (
              <div key={consultant.id} className="min-w-[220px] max-w-[220px] flex-shrink-0">
                <ConsultantCard consultant={consultant} variant="vertical" />
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={() => emblaApi?.scrollPrev()}
          className="absolute left-0 top-1/2 -translate-y-1/2 -ml-2 p-1.5 rounded-full bg-white/80 dark:bg-gray-800/80 shadow-md hover:bg-white dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-[#5E4B8B]" />
        </button>
        <button
          onClick={() => emblaApi?.scrollNext()}
          className="absolute right-0 top-1/2 -translate-y-1/2 -mr-2 p-1.5 rounded-full bg-white/80 dark:bg-gray-800/80 shadow-md hover:bg-white dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-[#5E4B8B]" />
        </button>
      </div>
    </div>
  );
}
