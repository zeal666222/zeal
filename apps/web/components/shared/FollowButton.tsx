"use client";
import {useState, useCallback} from "react";
import {Button} from "@zeal/ui";
import { Loader2, UserMinus, UserPlus } from "lucide-react";
import {useAuthGuard} from "@/hooks/useAuthGuard";

interface FollowButtonProps {
  userId: string;
  initialFollowing?: boolean;
  onChange?: (following: boolean) => void;
}

export function FollowButton({ userId, initialFollowing = false, onChange }: FollowButtonProps) {
  const { guard } = useAuthGuard();
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(() => {
    guard(async () => {
      setLoading(true);
      const next = !following;
      setFollowing(next);
      try {
        const res = await fetch("/api/users/" + userId + "/follow", {
          method: next ? "POST" : "DELETE",
        });
        if (!res.ok) throw new Error("Failed");
        onChange?.(next);
      } catch {
        setFollowing(!next);
      } finally {
        setLoading(false);
      }
    });
  }, [userId, following, onChange, guard]);

  return (
    <Button
      variant={following ? "secondary" : "primary"}
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" />
        : following ? <><UserMinus className="w-4 h-4" /> Following</>
        : <><UserPlus className="w-4 h-4" /> Follow</>}
    </Button>
  );
}

