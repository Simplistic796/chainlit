import { Queue, Worker, JobsOptions } from "bullmq";
export type AnalyticsRollupJobData = {
    date?: string | undefined;
};
export declare const analyticsRollupQueue: Queue<AnalyticsRollupJobData, any, string, AnalyticsRollupJobData, any, string>;
export declare const analyticsRollupWorker: Worker<AnalyticsRollupJobData, any, string>;
export declare function enqueueAnalyticsRollup(date?: string, opts?: JobsOptions): Promise<import("bullmq").Job<AnalyticsRollupJobData, any, string>>;
export declare function scheduleDailyRollup(): Promise<void>;
//# sourceMappingURL=rollup.d.ts.map