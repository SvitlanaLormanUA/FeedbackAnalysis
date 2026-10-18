import { Inject, Injectable, Logger } from '@nestjs/common';
import { LLM_GATEWAY, buildSentimentPrompt, parseSentiment } from './llm/llm-gateway';
import type { LlmGateway } from './llm/llm-gateway';
import { NormalizedText, SentimentResult } from './types';

/**
 * SentimentClassifier (C4 L4) — asks the LLM to label the review sentiment.
 * Empty comments short-circuit to NEUTRAL; LLM errors fall back gracefully.
 */
@Injectable()
export class SentimentClassifier {
  private readonly logger = new Logger(SentimentClassifier.name);

  constructor(@Inject(LLM_GATEWAY) private readonly gateway: LlmGateway) {}

  async classify(text: NormalizedText): Promise<SentimentResult> {
    if (text.empty) {
      return { sentiment: 'NEUTRAL', confidence: 0, conflictProbability: 0 };
    }
    try {
      const raw = await this.gateway.complete(buildSentimentPrompt(text.text));
      return parseSentiment(raw);
    } catch (err) {
      this.logger.warn(`Sentiment LLM call failed, defaulting to NEUTRAL: ${String(err)}`);
      return { sentiment: 'NEUTRAL', confidence: 0, conflictProbability: 0 };
    }
  }
}
