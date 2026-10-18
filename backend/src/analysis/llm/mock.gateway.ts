import { Injectable } from '@nestjs/common';
import { LlmGateway } from './llm-gateway';

/**
 * MockGateway — deterministic keyword heuristic used when no LLM key is set.
 * Lets the whole pipeline (and the demo deploy) run end-to-end for free.
 * Branches on the "TASK:" line that the prompt builders include.
 */
@Injectable()
export class MockGateway implements LlmGateway {
  private readonly negative = [
    'bad', 'terrible', 'awful', 'dirty', 'rude', 'slow', 'cold', 'wait',
    'погано', 'жахливо', 'брудно', 'грубо', 'повільно', 'холодн', 'черга', 'довго',
  ];
  private readonly positive = [
    'good', 'great', 'excellent', 'clean', 'friendly', 'fast', 'delicious', 'love',
    'добре', 'чудово', 'смачно', 'чисто', 'привітно', 'швидко', 'люблю', 'класно',
  ];

  complete(prompt: string): Promise<string> {
    const text = this.reviewText(prompt).toLowerCase();
    const neg = this.count(text, this.negative);
    const pos = this.count(text, this.positive);

    if (prompt.startsWith('TASK: aspects')) {
      return Promise.resolve(JSON.stringify({ aspects: this.aspects(text, pos, neg) }));
    }

    // sentiment
    let sentiment = 'NEUTRAL';
    if (pos > 0 && neg > 0) sentiment = 'MIXED';
    else if (neg > 0) sentiment = 'NEGATIVE';
    else if (pos > 0) sentiment = 'POSITIVE';

    const confidence = Math.min(1, 0.5 + 0.1 * (pos + neg));
    const conflictProbability = pos > 0 && neg > 0 ? 0.7 : neg > 1 ? 0.6 : 0.2;
    return Promise.resolve(
      JSON.stringify({ sentiment, confidence, conflictProbability }),
    );
  }

  private aspects(text: string, pos: number, neg: number) {
    const map: Array<[string[], string]> = [
      [['staff', 'waiter', 'service', 'персонал', 'офіціант', 'обслуг'], 'STAFF'],
      [['food', 'dish', 'meal', 'страв', 'їжа', 'кухн'], 'FOOD'],
      [['clean', 'dirty', 'чист', 'брудн'], 'CLEANLINESS'],
      [['price', 'expensive', 'cost', 'ціна', 'дорог', 'якіст'], 'PRICE_QUALITY'],
      [['wait', 'slow', 'queue', 'черга', 'очікув', 'повільно', 'довго'], 'WAITING_TIME'],
    ];
    const sentiment = neg > pos ? 'NEGATIVE' : pos > neg ? 'POSITIVE' : 'NEUTRAL';
    return map
      .filter(([keywords]) => keywords.some((k) => text.includes(k)))
      .map(([, category]) => ({ category, sentiment, quote: undefined }));
  }

  private reviewText(prompt: string): string {
    const m = prompt.match(/REVIEW: """([\s\S]*)"""/);
    return m ? m[1] : '';
  }

  private count(text: string, words: string[]): number {
    return words.reduce((acc, w) => acc + (text.includes(w) ? 1 : 0), 0);
  }
}
