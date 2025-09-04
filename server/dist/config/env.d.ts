import { z } from "zod";
declare const EnvSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "test", "production"]>>;
    PORT: z.ZodDefault<z.ZodNumber>;
    DATABASE_URL: z.ZodString;
    DEMO_API_KEY: z.ZodString | z.ZodOptional<z.ZodString>;
    STRIPE_SECRET_KEY: z.ZodOptional<z.ZodString>;
    STRIPE_PRICE_ID: z.ZodOptional<z.ZodString>;
    STRIPE_WEBHOOK_SECRET: z.ZodOptional<z.ZodString>;
    REDIS_URL: z.ZodOptional<z.ZodString>;
    SENTRY_DSN: z.ZodOptional<z.ZodString>;
    VITE_API_BASE: z.ZodOptional<z.ZodString>;
    FRONTEND_ORIGIN: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "test" | "production";
    PORT: number;
    DATABASE_URL: string;
    DEMO_API_KEY?: string | undefined;
    STRIPE_SECRET_KEY?: string | undefined;
    STRIPE_PRICE_ID?: string | undefined;
    STRIPE_WEBHOOK_SECRET?: string | undefined;
    REDIS_URL?: string | undefined;
    SENTRY_DSN?: string | undefined;
    VITE_API_BASE?: string | undefined;
    FRONTEND_ORIGIN?: string | undefined;
}, {
    DATABASE_URL: string;
    NODE_ENV?: "development" | "test" | "production" | undefined;
    PORT?: number | undefined;
    DEMO_API_KEY?: string | undefined;
    STRIPE_SECRET_KEY?: string | undefined;
    STRIPE_PRICE_ID?: string | undefined;
    STRIPE_WEBHOOK_SECRET?: string | undefined;
    REDIS_URL?: string | undefined;
    SENTRY_DSN?: string | undefined;
    VITE_API_BASE?: string | undefined;
    FRONTEND_ORIGIN?: string | undefined;
}>;
export type AppEnv = z.infer<typeof EnvSchema>;
export declare const env: AppEnv;
export {};
//# sourceMappingURL=env.d.ts.map