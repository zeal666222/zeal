// ZEAL_PHASE2_V1
// apps/web/app/api/wallet/resume/route.ts
// Returns the pending consultantId from /wallet?resume=… flows so the wallet
// page can auto-resume the chat after a successful top-up.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const resume = url.searchParams.get("resume");
  if (!resume || !/^[0-9a-f-]{36}$/i.test(resume)) {
    return NextResponse.json({ valid: false }, { status: 200 });
  }
  return NextResponse.json({ valid: true, consultantId: resume });
}
