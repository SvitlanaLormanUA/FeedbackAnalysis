import { MockGateway } from './mock.gateway';
import { buildSentimentPrompt, buildAspectsPrompt, parseSentiment, parseAspects } from './llm-gateway';

describe('MockGateway', () => {
  const gateway = new MockGateway();

  it('classifies clearly negative text as NEGATIVE', async () => {
    const raw = await gateway.complete(buildSentimentPrompt('The service was terrible and slow'));
    expect(parseSentiment(raw).sentiment).toBe('NEGATIVE');
  });

  it('classifies clearly positive text as POSITIVE', async () => {
    const raw = await gateway.complete(buildSentimentPrompt('Great food and friendly staff'));
    expect(parseSentiment(raw).sentiment).toBe('POSITIVE');
  });

  it('extracts the STAFF aspect', async () => {
    const raw = await gateway.complete(buildAspectsPrompt('The staff were rude'));
    const aspects = parseAspects(raw);
    expect(aspects.map((a) => a.category)).toContain('STAFF');
  });
});
