import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ANALYSIS_QUEUE, AnalyzeFeedbackJob } from '../analysis/types';

/**
 * AnalysisTaskDispatcher (C4 L4: BullMQ producer) — puts an "analyze feedback"
 * job on the Redis queue. The analysis worker consumes it asynchronously.
 */
@Injectable()
export class AnalysisTaskDispatcher {
  constructor(
    @InjectQueue(ANALYSIS_QUEUE) private readonly queue: Queue<AnalyzeFeedbackJob>,
  ) {}

  async enqueue(job: AnalyzeFeedbackJob): Promise<void> {
    await this.queue.add('analyze', job, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });
  }
}
