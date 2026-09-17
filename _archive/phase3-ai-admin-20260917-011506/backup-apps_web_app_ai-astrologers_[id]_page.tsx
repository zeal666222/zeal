"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Sparkles, Zap, Star, Loader2, AlertCircle,
} from "lucide-react";
import { Button, Badge, Card, CardContent } from "@zeal/ui";
import Link from "next/link";
import type { AiConsultant } from "@/hooks/useAiConsultants";

export default function AIAstrologerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [ai, setAi] = useState<AiConsultant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;

    fetch(`/api/ai/consultants/${params.id}`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setAi(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#9D7DC5]" />
      </div>
    );
  }

  if (error || !ai) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-500">{error || "AI consultant not found"}</p>
        <Link
          href="/ai-astrologers"
          className="text-[#9D7DC5] hover:underline mt-2 inline-block"
        >
          ← Back to AI Consultants
        </Link>
      </div>
    );
  }

  const handleStartChat = () => {
    router.push(`/chat/ai-${ai.id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="max-w-2xl mx-auto px-4 py-6"
    >
      <Link
        href="/ai-astrologers"
        className="flex items-center gap-2 text-[#9D7DC5] hover:underline mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to AI Consultants
      </Link>

      <Card className="border-[#E1C5E7] dark:border-gray-700">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative w-24 h-24 rounded-full overflow-hidden ring-4 ring-[#9D7DC5]/30">
              <img
                src={ai.avatar}
                alt={ai.name}
                className="w-full h-full object-cover"
              />
              <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-gradient-to-r from-[#9D7DC5] to-[#533AFD] text-white text-[8px] font-bold rounded-full">
                AI
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-bold text-[#5E4B8B] dark:text-white">
              {ai.name}
            </h1>
            <p className="text-sm text-[#B8A1D9] capitalize">
              {ai.category.toLowerCase()}
            </p>

            <div className="flex items-center gap-2 mt-2">
              <span className="text-yellow-500 flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-500" />
                {ai.rating.toFixed(1)}
              </span>
              <span className="text-xs text-[#B8A1D9]">
                ({ai.totalConsultations} consultations)
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mt-3 justify-center">
              {ai.isPaid ? (
                <Badge variant="warning">₹{ai.perMinuteRate}/min</Badge>
              ) : (
                <Badge variant="success">Free</Badge>
              )}
              {ai.persona && <Badge variant="outline">{ai.persona}</Badge>}
              {ai.gender && <Badge variant="outline">{ai.gender}</Badge>}
            </div>

            <p className="mt-4 text-[#5E4B8B] dark:text-white text-left w-full">
              {ai.bio}
            </p>

            {ai.specialties?.length > 0 && (
              <div className="mt-4 w-full text-left">
                <h3 className="text-sm font-medium text-[#5E4B8B] dark:text-white mb-2">
                  Specialties
                </h3>
                <div className="flex flex-wrap gap-2">
                  {ai.specialties.map((s) => (
                    <Badge key={s} variant="outline" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Button
              variant="primary"
              className="mt-6 w-full btn-luxury flex items-center justify-center gap-2"
              onClick={handleStartChat}
            >
              <Zap className="w-4 h-4" />
              {ai.isPaid
                ? `Start Paid Chat (₹${ai.perMinuteRate}/min)`
                : "Start Free Chat"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
