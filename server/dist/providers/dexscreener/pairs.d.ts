export type DexPair = {
    chainId: string;
    dexId: string;
    url: string;
    baseToken: {
        address: string;
        symbol: string;
        name: string;
    };
    quoteToken: {
        address: string;
        symbol: string;
        name: string;
    };
    liquidity: {
        usd: number;
    };
    volume: {
        h24: number;
    };
    priceUsd: string;
};
export declare function getDexPairs(address: string): Promise<DexPair[] | null>;
//# sourceMappingURL=pairs.d.ts.map