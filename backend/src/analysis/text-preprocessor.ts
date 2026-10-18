import { Injectable } from '@nestjs/common';
import { NormalizedText } from './types';

/**
 * TextPreprocessor (C4 L4) — cleans/normalises raw comment text, detects a
 * rough language and flags empty comments so the pipeline can short-circuit.
 */
@Injectable()
export class TextPreprocessor {
  private readonly maxLen = 2000;

  normalize(raw: string | null | undefined): NormalizedText {
    const text = (raw ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, this.maxLen);
    return {
      text,
      language: this.detectLanguage(text),
      empty: text.length === 0,
    };
  }

  private detectLanguage(text: string): string {
    if (/[Ѐ-ӿ]/.test(text)) return 'uk';
    if (/[a-z]/i.test(text)) return 'en';
    return 'unknown';
  }
}
