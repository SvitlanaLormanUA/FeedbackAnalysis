import { Injectable, Logger } from '@nestjs/common';
import { LlmGateway } from './llm-gateway';

/**
 * GeminiGateway (C4 L4) — calls the Google Gemini generateContent REST API.
 * Uses the global fetch (Node 18+); no extra SDK dependency.
 */
@Injectable()
export class GeminiGateway implements LlmGateway {
  private readonly logger = new Logger(GeminiGateway.name);
  // Stable alias → always the current Gemini Flash (free tier; Pro needs billing).
  // Override via GEMINI_MODEL (e.g. gemini-pro-latest once billing is enabled).
  private readonly model = process.env.GEMINI_MODEL ?? 'gemini-flash-latest';
  private readonly timeoutMs = 10_000;

  constructor(private readonly apiKey: string) {}

  async complete(prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    } finally {
      clearTimeout(timer);
    }
  }
}
