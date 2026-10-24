import {
  buildSentimentPrompt,
  buildAspectsPrompt,
  parseSentiment,
  parseAspects,
  VALID_ASPECTS,
} from './llm-gateway';

describe('llm-gateway prompts', () => {
  it('embeds the review text in the sentiment prompt', () => {
    const prompt = buildSentimentPrompt('rude staff');
    expect(prompt).toContain('TASK: sentiment');
    expect(prompt).toContain('rude staff');
  });

  it('lists all allowed categories in the aspects prompt', () => {
    const prompt = buildAspectsPrompt('cold food');
    expect(prompt).toContain('TASK: aspects');
    for (const category of VALID_ASPECTS) {
      expect(prompt).toContain(category);
    }
  });
});

describe('parseSentiment', () => {
  it('parses a valid JSON response', () => {
    const result = parseSentiment(
      '{"sentiment": "NEGATIVE", "confidence": 0.8, "conflictProbability": 0.3}',
    );
    expect(result).toEqual({
      sentiment: 'NEGATIVE',
      confidence: 0.8,
      conflictProbability: 0.3,
    });
  });

  it('extracts JSON wrapped in code fences / prose', () => {
    const raw = 'Sure!\n```json\n{"sentiment":"positive","confidence":0.9}\n```';
    const result = parseSentiment(raw);
    expect(result.sentiment).toBe('POSITIVE');
    expect(result.confidence).toBe(0.9);
    expect(result.conflictProbability).toBe(0);
  });

  it('falls back to NEUTRAL for an unknown sentiment label', () => {
    expect(parseSentiment('{"sentiment": "FURIOUS"}').sentiment).toBe('NEUTRAL');
  });

  it('falls back to NEUTRAL for unparseable input', () => {
    expect(parseSentiment('not json at all')).toEqual({
      sentiment: 'NEUTRAL',
      confidence: 0,
      conflictProbability: 0,
    });
  });

  it('clamps out-of-range and non-numeric scores to [0, 1]', () => {
    const result = parseSentiment(
      '{"sentiment": "MIXED", "confidence": 5, "conflictProbability": "oops"}',
    );
    expect(result.confidence).toBe(1);
    expect(result.conflictProbability).toBe(0);
  });
});

describe('parseAspects', () => {
  it('parses valid aspects and normalizes category case', () => {
    const raw =
      '{"aspects": [{"category": "staff", "sentiment": "negative", "quote": "rude"}]}';
    expect(parseAspects(raw)).toEqual([
      { category: 'STAFF', sentiment: 'NEGATIVE', quote: 'rude' },
    ]);
  });

  it('drops entries with invalid categories', () => {
    const raw =
      '{"aspects": [{"category": "WEATHER", "sentiment": "NEGATIVE"}, {"category": "FOOD", "sentiment": "POSITIVE"}]}';
    const result = parseAspects(raw);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('FOOD');
  });

  it('defaults an invalid aspect sentiment to NEUTRAL', () => {
    const result = parseAspects('{"aspects": [{"category": "FOOD", "sentiment": "yummy"}]}');
    expect(result[0].sentiment).toBe('NEUTRAL');
  });

  it('truncates long quotes to 280 characters', () => {
    const raw = `{"aspects": [{"category": "FOOD", "sentiment": "POSITIVE", "quote": "${'x'.repeat(500)}"}]}`;
    expect(parseAspects(raw)[0].quote).toHaveLength(280);
  });

  it('returns an empty array when there are no aspects or input is invalid', () => {
    expect(parseAspects('{"aspects": []}')).toEqual([]);
    expect(parseAspects('garbage')).toEqual([]);
  });
});
