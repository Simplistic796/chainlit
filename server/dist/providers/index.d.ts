import { MarketSnapshot } from "./coingecko/market";
export { getTopHolders } from "./covalent/holders";
export type UnifiedMarket = MarketSnapshot & {
    source: "coingecko";
};
export declare function getMarketSnapshot(input: string): Promise<UnifiedMarket | null>;
//# sourceMappingURL=index.d.ts.map