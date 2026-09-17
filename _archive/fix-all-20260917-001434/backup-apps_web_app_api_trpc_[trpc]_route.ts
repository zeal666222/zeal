import { prisma } from "@zeal/database";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@zeal/types/server";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({}),
  });

export const GET = handler;
export const POST = handler;
