"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const EnvSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "test", "production"]).default("development"),
    PORT: zod_1.z.coerce.number().default(3000),
    DATABASE_URL: zod_1.z.string().min(1),
    DEMO_API_KEY: zod_1.z.string().min(1),
    STRIPE_SECRET_KEY: zod_1.z.string().optional(),
    STRIPE_PRICE_ID: zod_1.z.string().optional(),
    STRIPE_WEBHOOK_SECRET: zod_1.z.string().optional(),
    REDIS_URL: zod_1.z.string().optional(),
    SENTRY_DSN: zod_1.z.string().optional(),
    VITE_API_BASE: zod_1.z.string().optional(),
});
exports.env = EnvSchema.parse(process.env);
//# sourceMappingURL=env.js.map