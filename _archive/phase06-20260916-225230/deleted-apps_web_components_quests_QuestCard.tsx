"use client";

import * as React from "react";
import { Quest, QuestProgress } from "@zeal/types";
import { Badge, Button } from "@zeal/ui";
import { CheckCircle, Circle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface QuestCardProps {
  quest: Quest;
  progress: QuestProgress | null;
  onComplete?: (questId: string) => void;
  isPending?: boolean;
}

export function QuestCard({ quest, progress, onComplete, isPending = false }: QuestCardProps) {
  const isCompleted = progress?.isCompleted || false;
  const currentProgress = progress?.progress || 0;
  const percentage = Math.min((currentProgress / quest.requirement) * 100, 100);
  const isFullyCompleted = currentProgress >= quest.requirement;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-gray-900 rounded-xl border border-[#E1C5E7] dark:border-gray-700 p-4 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{quest.icon}</div>
          <div>
            <h4 className="font-semibold text-[#5E4B8B] dark:text-white">{quest.name}</h4>
            <p className="text-sm text-[#B8A1D9] dark:text-gray-400">{quest.description}</p>
          </div>
        </div>
        <Badge variant={isCompleted ? "success" : "default"}>
          {isCompleted ? "✅ Completed" : `${currentProgress}/${quest.requirement}`}
        </Badge>
      </div>

      <div className="mt-3">
        <div className="w-full h-2 bg-[#E1C5E7] dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-[#9D7DC5] rounded-full"
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-[#B8A1D9] dark:text-gray-400">
            {isCompleted ? "🎉 Completed!" : `${Math.round(percentage)}% done`}
          </span>
          <span className="text-sm font-medium text-[#FFD700] flex items-center gap-1">
            ⚡ +{quest.reward} Sparks
          </span>
        </div>
      </div>

      {!isCompleted && onComplete && (
        <Button
          variant="primary"
          className="mt-3 w-full"
          onClick={() => onComplete(quest.id)}
          disabled={!isFullyCompleted || isPending}
        >
          {isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
          ) : isFullyCompleted ? (
            "Claim Reward"
          ) : (
            `${currentProgress}/${quest.requirement} Progress`
          )}
        </Button>
      )}
    </motion.div>
  );
}
