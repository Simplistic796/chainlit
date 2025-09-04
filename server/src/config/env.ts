import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string().min(1),
  DEMO_API_KEY: process.env.NODE_ENV === "production"
    ? z.string().min(1)            // required in prod
    : z.string().min(1).optional(),// optional outside prod

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PRICE_ID: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  REDIS_URL: z.string().optional(),
  SENTRY_DSN: z.string().optional(),

  VITE_API_BASE: z.string().optional(),
  FRONTEND_ORIGIN: z.string().optional(),
  
  // Additional environment variables that might be needed for portfolio functionality
  COINGECKO_KEY: z.string().optional(),
  ALPHAVANTAGE_KEY: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  FRONTEND_ORIGINS: z.string().optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;

// Parse with better error handling
const envResult = EnvSchema.safeParse(process.env);
if (!envResult.success) {
  console.error("❌ Environment validation failed:");
  console.error(JSON.stringify(envResult.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env: AppEnv = envResult.data;


