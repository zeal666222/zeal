// ═══════════════════════════════════════════════════════════════════════════════
// tRPC handler — thin adapter over appRouter from @zeal/types/server
// ═══════════════════════════════════════════════════════════════════════════════
import {fetchRequestHandler} from "@trpc/server/adapters/fetch";
import {appRouter} from "@zeal/types/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({}),
  });

export const GET = handler;
export const POST = handler;
