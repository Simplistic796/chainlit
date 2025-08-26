// src/providers/etherscan/contract.ts
import { etherscanGet } from "./api";

export type ContractMeta = {
  verified: boolean;
  contractName?: string;
  compilerVersion?: string;
  licenseType?: string;
  proxy?: boolean;
  implementation?: string | null;
};

type SourceCodeRow = {
  SourceCode: string;
  ABI: string;
  ContractName: string;
  CompilerVersion: string;
  OptimizationUsed: "0" | "1";
  Runs: string;
  ConstructorArguments: string;
  EVMVersion: string;
  Library: string;
  LicenseType: string;
  Proxy: "0" | "1";
  Implementation: string;
  SwarmSource: string;
};

export async function getContractMeta(address: string): Promise<ContractMeta | null> {
  const result = await etherscanGet<SourceCodeRow[]>(
    { module: "contract", action: "getsourcecode", address }
  );
  if (!result || !Array.isArray(result) || result.length === 0) return null;

  const row = result[0];
  if (!row) return null;
  
  const verified = !!row.SourceCode && row.SourceCode !== "Contract source code not verified";

  const meta: ContractMeta = {
    verified,
    proxy: row.Proxy === "1",
    implementation: row.Implementation || null,
  };

  if (row.ContractName) meta.contractName = row.ContractName;
  if (row.CompilerVersion) meta.compilerVersion = row.CompilerVersion;
  if (row.LicenseType) meta.licenseType = row.LicenseType;

  return meta;
}
