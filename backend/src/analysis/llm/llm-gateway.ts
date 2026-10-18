import { Aspect, AspectCategory, Sentiment, SentimentResult } from '../types';

/** DI token for the active LlmGateway implementation. */
export const LLM_GATEWAY = Symbol('LLM_GATEWAY');

/**
 * LlmGateway (C4 L4) — low-level LLM client. Implementations own HTTP calls,
 * retries, timeouts and parsing of the structured JSON response. Sentiment
 * Classifier and AspectExtractor build prompts and call complete().
 */
export interface LlmGateway {
  complete(prompt: string): Promise<string>;
}

export const VALID_ASPECTS: AspectCategory[] = [
  'STAFF',
  'FOOD',
  'CLEANLINESS',
  'PRICE_QUALITY',
  'WAITING_TIME',
];

const VALID_SENTIMENTS: Sentiment[] = ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED'];

export function buildSentimentPrompt(text: string): string {
  return [
    'TASK: sentiment',
    'You are a feedback sentiment classifier for service businesses.',
    'Classify the review sentiment as one of: POSITIVE, NEUTRAL, NEGATIVE, MIXED.',
    'Return ONLY JSON: {"sentiment": "...", "confidence": 0..1, "conflictProbability": 0..1}.',
    `REVIEW: """${text}"""`,
  ].join('\n');
}

export function buildAspectsPrompt(text: string): string {
  return [
    'TASK: aspects',
    'You extract business aspects mentioned in a customer review.',
    `Allowed categories: ${VALID_ASPECTS.join(', ')}.`,
    'For each mentioned aspect give its local sentiment (POSITIVE/NEUTRAL/NEGATIVE/MIXED) and a short quote.',
    'Return ONLY JSON: {"aspects": [{"category": "...", "sentiment": "...", "quote": "..."}]}.',
    `REVIEW: """${text}"""`,
  ].join('\n');
}

/** Safely parse a sentiment JSON response; falls back to NEUTRAL. */
export function parseSentiment(raw: string): SentimentResult {
  const json = extractJson(raw);
  const sentiment = normalizeSentiment(json?.sentiment);
  return {
    sentiment,
    confidence: clamp01(Number(json?.confidence)),
    conflictProbability: clamp01(Number(json?.conflictProbability)),
  };
}

/** Safely parse an aspects JSON response; drops invalid entries. */
export function parseAspects(raw: string): Aspect[] {
  const json = extractJson(raw);
  const list = Array.isArray(json?.aspects) ? json.aspects : [];
  const result: Aspect[] = [];
  for (const item of list) {
    const category = String(item?.category ?? '').toUpperCase() as AspectCategory;
    if (!VALID_ASPECTS.includes(category)) continue;
    result.push({
      category,
      sentiment: normalizeSentiment(item?.sentiment),
      quote: typeof item?.quote === 'string' ? item.quote.slice(0, 280) : undefined,
    });
  }
  return result;
}

function normalizeSentiment(value: unknown): Sentiment {
  const v = (typeof value === 'string' ? value : '').toUpperCase() as Sentiment;
  return VALID_SENTIMENTS.includes(v) ? v : 'NEUTRAL';
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Extracts the first JSON object from an LLM response (handles code fences). */
function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}
