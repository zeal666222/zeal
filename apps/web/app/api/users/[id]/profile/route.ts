// apps/web/app/api/users/[id]/profile/route.ts
// GET  → full profile + stats (RPC)
// PUT  → not used; use Server Action instead
import { NextResponse } from "next/server";
import { createServerClientFromCookies } from "@zeal/database/server";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withErrorHandler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      throw new AppError("Invalid user id", 400, ErrorCode.VALIDATION_INPUT);
    }

    const supabase = await createServerClientFromCookies();
    const { data, error } = await supabase.rpc("get_profile_stats", {
      p_user_id: id,
    });

    if (error) {
      throw new AppError(error.message, 500, ErrorCode.INTERNAL_SERVER);
    }
    if (!data) {
      throw new AppError("User not found", 404, ErrorCode.NOT_FOUND);
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  },
);
