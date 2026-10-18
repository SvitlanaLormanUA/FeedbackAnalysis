// types.ts — shared value objects for the analysis pipeline (C4 L4 block).
import { Sentiment, AspectCategory } from '@prisma/client';

export { Sentiment, AspectCategory };

/** Cleaned text produced by TextPreprocessor. */
export interface NormalizedText {
  text: string;
  language: string;
  empty: boolean;
}

/** Output of SentimentClassifier. */
export interface SentimentResult {
  sentiment: Sentiment;
  confidence: number;
  conflictProbability: number;
}

/** A single aspect extracted by AspectExtractor. */
export interface Aspect {
  category: AspectCategory;
  sentiment: Sentiment;
  quote?: string;
}

/** Verdict from CriticalityDetector. */
export interface CriticalityVerdict {
  isCritical: boolean;
  reason?: string; // e.g. 'LOW_RATING' | 'SERIOUS_NEGATIVE'
}

/** Full outcome persisted by AnalysisResultRepository. */
export interface AnalysisOutcome {
  sentiment: SentimentResult;
  aspects: Aspect[];
  verdict: CriticalityVerdict;
}

/** Event passed to the notification service when a review is critical. */
export interface CriticalFeedbackEvent {
  feedbackId: string;
  venueId: string;
  rating: number;
  comment?: string;
  receivedAt: Date;
  reason?: string;
}

/** Job payload enqueued by AnalysisTaskDispatcher. */
export interface AnalyzeFeedbackJob {
  feedbackId: string;
  venueId: string;
}

export const ANALYSIS_QUEUE = 'feedback-analysis';
