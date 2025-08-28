import { Queue, Worker, JobsOptions } from "bullmq";
export type DailyJobData = {
    limit: number;
};
export declare const dailyQueue: Queue<DailyJobData, any, string, DailyJobData, any, string>;
export declare const dailyWorker: Worker<DailyJobData, any, string>;
export declare function scheduleDaily(limit?: number): Promise<void>;
export declare function runOnce(limit?: number, opts?: JobsOptions): Promise<import("bullmq").Job<DailyJobData, any, string>>;
//# sourceMappingURL=dailySignals.d.ts.map