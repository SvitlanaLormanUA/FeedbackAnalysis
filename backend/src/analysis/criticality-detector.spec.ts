import { CriticalityDetector } from './criticality-detector';
import { SentimentResult } from './types';

describe('CriticalityDetector', () => {
  const detector = new CriticalityDetector();
  const neutral: SentimentResult = {
    sentiment: 'NEUTRAL',
    confidence: 0.9,
    conflictProbability: 0.1,
  };

  it('flags low ratings as critical', () => {
    expect(detector.evaluate(1, neutral)).toEqual({ isCritical: true, reason: 'LOW_RATING' });
    expect(detector.evaluate(2, neutral)).toEqual({ isCritical: true, reason: 'LOW_RATING' });
  });

  it('does not flag good ratings with neutral text', () => {
    expect(detector.evaluate(5, neutral).isCritical).toBe(false);
  });

  it('flags confident negative text even with a decent rating', () => {
    const verdict = detector.evaluate(4, {
      sentiment: 'NEGATIVE',
      confidence: 0.8,
      conflictProbability: 0.2,
    });
    expect(verdict).toEqual({ isCritical: true, reason: 'SERIOUS_NEGATIVE' });
  });

  it('flags high conflict probability', () => {
    const verdict = detector.evaluate(4, {
      sentiment: 'MIXED',
      confidence: 0.5,
      conflictProbability: 0.8,
    });
    expect(verdict.isCritical).toBe(true);
  });
});
