export type DailyClose = {
    date: string;
    token: string;
    close: number;
};
export type PriceHistoryRequest = {
    tokens: string[];
    days: number;
    includeBenchmarks?: boolean;
};
export type PriceHistoryResponse = {
    dates: string[];
    closes: Record<string, number[]>;
    benchmarks: {
        btc: number[];
        eth: number[];
    };
};
export declare function getPriceHistory(request: PriceHistoryRequest): Promise<PriceHistoryResponse | null>;
export declare function getDailyClosesUSD(symbol: string, days: number): Promise<number[] | null>;
//# sourceMappingURL=history.d.ts.map