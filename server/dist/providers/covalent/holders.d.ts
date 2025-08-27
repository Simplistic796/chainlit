export type HolderInfo = {
    address: string;
    balance: string;
    balance_quote: number;
};
export declare function getTopHolders(address: string, chainId?: number, limit?: number): Promise<HolderInfo[] | null>;
//# sourceMappingURL=holders.d.ts.map