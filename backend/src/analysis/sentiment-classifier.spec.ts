import { SentimentClassifier } from './sentiment-classifier';
import type { LlmGateway } from './llm/llm-gateway';
import { NormalizedText } from './types';

const nonEmpty = (text: string): NormalizedText => ({
  text,
  language: 'en',
  empty: false,
});

describe('SentimentClassifier', () => {
  it('short-circuits empty text to NEUTRAL without calling the gateway', async () => {
    const complete = jest.fn();
    const classifier = new SentimentClassifier({ complete } as LlmGateway);

    const result = await classifier.classify({ text: '', language: 'unknown', empty: true });

    expect(result).toEqual({ sentiment: 'NEUTRAL', confidence: 0, conflictProbability: 0 });
    expect(complete).not.toHaveBeenCalled();
  });

  it('parses the gateway response for non-empty text', async () => {
    const gateway: LlmGateway = {
      complete: async () => '{"sentiment": "POSITIVE", "confidence": 0.7, "conflictProbability": 0.1}',
    };
    const classifier = new SentimentClassifier(gateway);

    const result = await classifier.classify(nonEmpty('lovely place'));

    expect(result.sentiment).toBe('POSITIVE');
    expect(result.confidence).toBe(0.7);
  });

  it('falls back to NEUTRAL when the gateway throws', async () => {
    const gateway: LlmGateway = {
      complete: async () => {
        throw new Error('LLM down');
      },
    };
    const classifier = new SentimentClassifier(gateway);

    const result = await classifier.classify(nonEmpty('something'));

    expect(result).toEqual({ sentiment: 'NEUTRAL', confidence: 0, conflictProbability: 0 });
  });
});
