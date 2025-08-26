export type AnalysisResult = {
    token: string;
    score: number;
    risk: "Low" | "Medium" | "High";
    outlook: "Bearish" | "Neutral" | "Bullish";
    evidence: string[];
};
export declare function analyzeToken(input: string): Promise<AnalysisResult>;
//# sourceMappingURL=scoring.d.ts.map