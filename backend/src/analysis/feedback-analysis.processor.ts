import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ANALYSIS_QUEUE, AnalyzeFeedbackJob } from './types';
import { TextPreprocessor } from './text-preprocessor';
import { SentimentClassifier } from './sentiment-classifier';
import { AspectExtractor } from './aspect-extractor';
import { CriticalityDetector } from './criticality-detector';
import { AnalysisResultRepository } from './analysis-result.repository';
import { AlertDispatcher } from '../notifications/alert-dispatcher';

/**
 * FeedbackAnalysisProcessor (C4 L4) — consumes jobs from the Redis queue and
 * runs the analysis pipeline. Numbered to match the diagram:
 *   1: loadFeedback  2: normalize  3a: classify / 3b: extract (parallel)
 *   4: evaluate criticality  5: saveOutcome  6: dispatch alert (if critical)
 */
@Processor(ANALYSIS_QUEUE)
export class FeedbackAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(FeedbackAnalysisProcessor.name);

  constructor(
    private readonly preprocessor: TextPreprocessor,
    private readonly sentimentClassifier: SentimentClassifier,
    private readonly aspectExtractor: AspectExtractor,
    private readonly criticality: CriticalityDetector,
    private readonly repo: AnalysisResultRepository,
    private readonly alerts: AlertDispatcher,
  ) {
    super();
  }

  async process(job: Job<AnalyzeFeedbackJob>): Promise<void> {
    const { feedbackId } = job.data;
    const feedback = await this.repo.loadFeedback(feedbackId); // 1
    if (!feedback) {
      this.logger.warn(`Feedback ${feedbackId} no longer exists, skipping.`);
      return;
    }

    try {
      const normalized = this.preprocessor.normalize(feedback.comment); // 2
      const [sentiment, aspects] = await Promise.all([
        this.sentimentClassifier.classify(normalized), // 3a
        this.aspectExtractor.extract(normalized), // 3b
      ]);
      const verdict = this.criticality.evaluate(feedback.rating, sentiment); // 4

      await this.repo.saveOutcome(feedbackId, { sentiment, aspects, verdict }); // 5

      if (verdict.isCritical) {
        const prefix = `${feedback.venueId}:`;
        const rawTable = feedback.qrCodeId.startsWith(prefix)
          ? feedback.qrCodeId.slice(prefix.length)
          : feedback.qrCodeId.includes(':')
            ? feedback.qrCodeId.slice(feedback.qrCodeId.indexOf(':') + 1)
            : null;
        const tableLabel = rawTable && rawTable !== 'default' ? rawTable : undefined;

        await this.alerts.dispatch({
          feedbackId: feedback.id,
          venueId: feedback.venueId,
          rating: feedback.rating,
          comment: feedback.comment ?? undefined,
          receivedAt: feedback.createdAt,
          reason: verdict.reason,
          tableLabel,
        }); // 6
      }
    } catch (err) {
      this.logger.error(`Analysis failed for ${feedbackId}`, err as Error);
      await this.repo.markFailed(feedbackId);
      throw err; // let BullMQ retry per the job's backoff policy
    }
  }
}
