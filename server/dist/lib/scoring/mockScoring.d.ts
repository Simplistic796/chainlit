/**
 * A simple, deterministic scoring engine for MVP.
 * - It does NOT call real APIs yet.
 * - It produces explainable outputs based on token text.
 */
export type AnalysisResult = {
    token: string;
    score: number;
    risk: "Low" | "Medium" | "High";
    outlook: "Bearish" | "Neutral" | "Bullish";
    evidence: string[];
};
export declare function inferTokenType(input: string): "symbol" | "address";
export declare function analyzeTokenMock(raw: string): AnalysisResult;
//# sourceMappingURL=mockScoring.d.ts.map