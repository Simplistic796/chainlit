import { Queue, QueueEvents, Worker, JobsOptions } from "bullmq";
export type AnalyzeJobData = {
    token: string;
};
export declare const analyzeQueue: Queue<AnalyzeJobData, any, string, AnalyzeJobData, any, string>;
export declare const analyzeEvents: QueueEvents;
export declare const analyzeWorker: Worker<AnalyzeJobData, any, string>;
export declare function enqueueAnalyze(token: string, opts?: JobsOptions): Promise<import("bullmq").Job<AnalyzeJobData, any, string>>;
//# sourceMappingURL=queue.d.ts.map