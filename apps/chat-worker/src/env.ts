export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  ASTRO_WORKER_URL: string;

  // Supabase (secrets)
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string;

  // AI provider keys (secrets)
  GROQ_API_KEY: string;
  AGNES_API_KEY?: string;
  ZHIPU_API_KEY?: string;
  CF_ACCOUNT_ID: string;
  CF_AI_TOKEN: string;
  CF_AI_MODEL?: string;
}

export interface JWTPayload {
  sub: string;
  role: string;
  exp: number;
  iat: number;
  aud?: string;
}
