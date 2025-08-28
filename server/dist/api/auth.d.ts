export declare function hashKey(raw: string): string;
export declare function findApiKey(rawKey: string): Promise<{
    id: number;
    createdAt: Date;
    name: string;
    keyHash: string;
    plan: string;
    requestsPerMin: number;
    requestsPerDay: number;
    isActive: boolean;
    updatedAt: Date;
    userId: number | null;
} | null>;
/** Generate a new raw key (returns {raw, hash}) — store hash only! */
export declare function generateRawKey(): {
    raw: string;
    hash: string;
};
//# sourceMappingURL=auth.d.ts.map