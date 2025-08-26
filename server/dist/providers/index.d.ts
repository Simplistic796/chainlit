import { MarketSnapshot } from "./coingecko/market";
export type UnifiedMarket = MarketSnapshot & {
    source: "coingecko";
};
export declare function getMarketSnapshot(input: string): Promise<UnifiedMarket | null>;
//# sourceMappingURL=index.d.ts.map