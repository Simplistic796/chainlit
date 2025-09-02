export declare function hashKey(raw: string): string;
export declare function findApiKey(rawKey: string): Promise<{
    id: number;
    createdAt: Date;
    name: string;
    userId: number | null;
    plan: string;
    keyHash: string;
    requestsPerMin: number;
    requestsPerDay: number;
    isActive: boolean;
    updatedAt: Date;
} | null>;
/** Generate a new raw key (returns {raw, hash}) — store hash only! */
export declare function generateRawKey(): {
    raw: string;
    hash: string;
};
//# sourceMappingURL=auth.d.ts.map