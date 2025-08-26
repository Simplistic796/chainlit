export type CGCoin = {
    id: string;
    symbol: string;
    name: string;
    platforms?: Record<string, string | null>;
};
export declare function getCoinsList(): Promise<CGCoin[]>;
export declare function resolveToCoinId(inputRaw: string): Promise<{
    id: string;
    symbol: string;
} | null>;
//# sourceMappingURL=coinsList.d.ts.map