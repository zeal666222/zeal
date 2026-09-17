"use client";

import * as React from "react";
import { Sparkles, Trophy, Crown, Award } from "lucide-react";
import { SparkBazaarListing } from "@zeal/types";
import { Button, Badge } from "@zeal/ui";
import { Avatar, AvatarImage, AvatarFallback } from "@zeal/ui";

interface BazaarListingProps {
  listings: SparkBazaarListing[];
  onBid: (listingId: string) => void;
}

export function BazaarListing({ listings, onBid }: BazaarListingProps) {
  const tierConfig = {
    bronze: { icon: <Award className="w-5 h-5 text-amber-600" />, label: "Bronze", color: "bg-amber-100 text-amber-800" },
    silver: { icon: <Trophy className="w-5 h-5 text-gray-400" />, label: "Silver", color: "bg-gray-100 text-gray-700" },
    gold: { icon: <Crown className="w-5 h-5 text-yellow-500" />, label: "Gold", color: "bg-yellow-100 text-yellow-800" },
  };

  return (
    <div className="space-y-4">
      {listings.map((listing) => {
        const tier = tierConfig[listing.tier];
        const userAvatar = listing.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(listing.user?.name || listing.user?.email || "User")}&background=9D7DC5&color=fff`;

        return (
          <div
            key={listing.id}
            className="bg-white rounded-xl border border-[#E1C5E7] p-4 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={userAvatar} alt={listing.user?.name || listing.user?.email} />
                  <AvatarFallback>
                    {listing.user?.name?.[0] || listing.user?.email?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-[#5E4B8B] dark:text-white">
                    {listing.user?.name || listing.user?.email}
                  </p>
                  <p className="text-sm text-[#B8A1D9] dark:text-gray-400">
                    @{listing.user?.email?.split("@")[0] || "user"}
                  </p>
                </div>
              </div>
              <Badge variant="default" className={tier.color}>
                {tier.icon} {tier.label}
              </Badge>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#E1C5E7]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#FFD700]" />
                <span className="font-bold text-[#5E4B8B] dark:text-white">
                  {listing.sparks.toLocaleString()} Sparks
                </span>
              </div>
              <Button
                variant="primary"
                onClick={() => onBid(listing.id)}
                disabled={!listing.isAvailable}
              >
                {listing.isAvailable ? "Place Bid" : "Unavailable"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
