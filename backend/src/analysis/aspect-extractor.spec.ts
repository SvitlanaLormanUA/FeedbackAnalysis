import { AspectExtractor } from './aspect-extractor';
import type { LlmGateway } from './llm/llm-gateway';
import { NormalizedText } from './types';

const nonEmpty = (text: string): NormalizedText => ({
  text,
  language: 'en',
  empty: false,
});

describe('AspectExtractor', () => {
  it('returns no aspects for empty text without calling the gateway', async () => {
    const complete = jest.fn();
    const extractor = new AspectExtractor({ complete } as LlmGateway);

    const result = await extractor.extract({ text: '', language: 'unknown', empty: true });

    expect(result).toEqual([]);
    expect(complete).not.toHaveBeenCalled();
  });

  it('parses aspects from the gateway response', async () => {
    const gateway: LlmGateway = {
      complete: async () =>
        '{"aspects": [{"category": "STAFF", "sentiment": "NEGATIVE", "quote": "rude"}]}',
    };
    const extractor = new AspectExtractor(gateway);

    const result = await extractor.extract(nonEmpty('the staff were rude'));

    expect(result).toEqual([{ category: 'STAFF', sentiment: 'NEGATIVE', quote: 'rude' }]);
  });

  it('returns an empty array when the gateway throws', async () => {
    const gateway: LlmGateway = {
      complete: async () => {
        throw new Error('LLM down');
      },
    };
    const extractor = new AspectExtractor(gateway);

    expect(await extractor.extract(nonEmpty('anything'))).toEqual([]);
  });
});
