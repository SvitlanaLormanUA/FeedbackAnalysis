import { Injectable } from '@nestjs/common';
import { CriticalityVerdict, SentimentResult } from './types';

/**
 * CriticalityDetector (C4 L4) — rule-based decision. A review is critical if the
 * rating is low (<= 2) OR the text analysis points to serious negativity/conflict.
 */
@Injectable()
export class CriticalityDetector {
  private readonly ratingThreshold = 2;
  private readonly conflictThreshold = 0.6;
  private readonly negativeConfidenceThreshold = 0.6;

  evaluate(rating: number, sentiment: SentimentResult): CriticalityVerdict {
    if (rating <= this.ratingThreshold) {
      return { isCritical: true, reason: 'LOW_RATING' };
    }
    const seriousNegative =
      sentiment.sentiment === 'NEGATIVE' &&
      sentiment.confidence >= this.negativeConfidenceThreshold;
    const highConflict = sentiment.conflictProbability >= this.conflictThreshold;
    if (seriousNegative || highConflict) {
      return { isCritical: true, reason: 'SERIOUS_NEGATIVE' };
    }
    return { isCritical: false };
  }
}
