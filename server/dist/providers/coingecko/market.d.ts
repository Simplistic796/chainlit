export type MarketSnapshot = {
    coinId: string;
    symbol: string;
    priceUsd: number;
    marketCap: number;
    volume24h: number;
    d1Pct: number;
    d7Pct: number;
};
export declare function getMarketById(coinId: string, symbol: string): Promise<MarketSnapshot | null>;
//# sourceMappingURL=market.d.ts.map