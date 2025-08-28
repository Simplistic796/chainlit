import { Queue, Worker } from "bullmq";
export declare const alertsQueue: Queue<any, any, string, any, any, string>;
export declare const alertsWorker: Worker<any, {
    processed: number;
    fired?: never;
} | {
    processed: number;
    fired: number;
}, string>;
export declare function scheduleAlertEvaluator(): Promise<void>;
//# sourceMappingURL=evaluator.d.ts.map