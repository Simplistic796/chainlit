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
});

export type AppEnv = z.infer<typeof EnvSchema>;
export const env: AppEnv = EnvSchema.parse(process.env);


