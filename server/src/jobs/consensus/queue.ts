import { Queue, Worker, JobsOptions, QueueEvents } from "bullmq";
import { getRedisForBullMQ } from "../../cache/redis";
import { debateRoundRobin } from "../../agents/consensus/roundRobin";
import { AgentInput, DebateConfig } from "../../agents/shared/types";

const connection = getRedisForBullMQ();

export type DebateJobData = { input: AgentInput; cfg?: Partial<DebateConfig> };

export const debateQueue = new Queue<DebateJobData>("consensus.debate", { connection: connection as any });
export const debateEvents = connection ? new QueueEvents("consensus.debate", { connection: connection as any }) : null as unknown as QueueEvents;

export const debateWorker = new Worker<DebateJobData>(
  "consensus.debate",
  async (job) => {
    const cfg: DebateConfig = { rounds: 3, quorum: 0.5, ...(job.data.cfg || {}) };
    return debateRoundRobin(job.data.input, cfg);
  },
  { connection: connection as any, concurrency: 2 }
);

export async function enqueueDebate(input: AgentInput, opts?: JobsOptions) {
  return debateQueue.add("debate", { input }, { removeOnComplete: 50, removeOnFail: 50, ...(opts || {}) });
}
