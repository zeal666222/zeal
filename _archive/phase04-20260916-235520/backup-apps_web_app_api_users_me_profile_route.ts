import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { withErrorHandler, AppError, ErrorCode } from "@/lib/errors";

export const GET = withErrorHandler(async (req: Request) => {
  const userId = await getUserId();
  if (!userId) throw new AppError("Unauthorized", 401, ErrorCode.AUTH_UNAUTHORIZED);

  const url = new URL(req.url);
  url.pathname = "/api/users/" + userId + "/profile";
  const res = await fetch(url.toString(), { headers: req.headers });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
});

