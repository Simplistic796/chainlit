import { Queue, Worker, JobsOptions } from "bullmq";
import { AgentInput, DebateConfig } from "../../agents/shared/types";
export type DebateJobData = {
    input: AgentInput;
    cfg?: Partial<DebateConfig>;
};
export declare const debateQueue: Queue<DebateJobData, any, string, DebateJobData, any, string>;
export declare const debateWorker: Worker<DebateJobData, any, string>;
export declare function enqueueDebate(input: AgentInput, opts?: JobsOptions): Promise<import("bullmq").Job<DebateJobData, any, string>>;
//# sourceMappingURL=queue.d.ts.map