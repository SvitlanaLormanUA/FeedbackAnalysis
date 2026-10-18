import { Inject, Injectable, Logger } from '@nestjs/common';
import { LLM_GATEWAY, buildAspectsPrompt, parseAspects } from './llm/llm-gateway';
import type { LlmGateway } from './llm/llm-gateway';
import { Aspect, NormalizedText } from './types';

/**
 * AspectExtractor (C4 L4) — extracts business aspects (staff, food, cleanliness,
 * price/quality, waiting time) with their local sentiment.
 */
@Injectable()
export class AspectExtractor {
  private readonly logger = new Logger(AspectExtractor.name);

  constructor(@Inject(LLM_GATEWAY) private readonly gateway: LlmGateway) {}

  async extract(text: NormalizedText): Promise<Aspect[]> {
    if (text.empty) return [];
    try {
      const raw = await this.gateway.complete(buildAspectsPrompt(text.text));
      return parseAspects(raw);
    } catch (err) {
      this.logger.warn(`Aspect LLM call failed, returning none: ${String(err)}`);
      return [];
    }
  }
}
