"use client";
import { Share2, Copy, Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button, Input } from "@zeal/ui";

interface ReferralCardProps {
  referralLink: string;
  referralCount: number;
  sparksEarned: number;
}

export function ReferralCard({ referralLink, referralCount, sparksEarned }: ReferralCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: "Join Zeal – Faith & Wellness Platform",
        text: "Join me on Zeal! Use my referral link:",
        url: referralLink,
      });
    } else {
      handleCopy();
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#E1C5E7] p-6">
      <h3 className="text-lg font-bold text-[#5E4B8B] flex items-center gap-2">
        <Share2 className="w-5 h-5 text-[#9D7DC5]" /> Refer & Earn
      </h3>
      <p className="text-sm text-[#B8A1D9] mt-2">
        Share your referral link and earn <strong className="text-[#9D7DC5]">+50 Sparks</strong> for each friend who joins!
      </p>

      <div className="flex items-center gap-2 mt-4">
        <Input
          value={referralLink}
          readOnly
          className="flex-1 text-sm bg-[#F4E8F7] border-[#E1C5E7]"
        />
        <Button variant="secondary" onClick={handleCopy} className="flex-shrink-0">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </Button>
        <Button variant="primary" onClick={handleShare} className="flex-shrink-0">
          <Share2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-6 mt-4 pt-4 border-t border-[#E1C5E7]">
        <div>
          <p className="text-sm text-[#B8A1D9]">Referrals</p>
          <p className="text-xl font-bold text-[#5E4B8B]">{referralCount}</p>
        </div>
        <div>
          <p className="text-sm text-[#B8A1D9]">Sparks Earned</p>
          <p className="text-xl font-bold text-[#FFD700] flex items-center gap-1">
            <Sparkles className="w-4 h-4" /> {sparksEarned}
          </p>
        </div>
      </div>
    </div>
  );
}
