import IORedis from "ioredis";
export declare function getRedis(): IORedis | null;
export declare function getRedisForBullMQ(): IORedis | null;
export declare function cacheSetJSON(key: string, value: unknown, ttlSec?: number): Promise<void>;
export declare function cacheGetJSON<T>(key: string): Promise<T | null>;
//# sourceMappingURL=redis.d.ts.map