export type ContractMeta = {
    verified: boolean;
    contractName?: string;
    compilerVersion?: string;
    licenseType?: string;
    proxy?: boolean;
    implementation?: string | null;
};
export declare function getContractMeta(address: string): Promise<ContractMeta | null>;
//# sourceMappingURL=contract.d.ts.map