import { Injectable } from '@nestjs/common';
import { LlmGateway } from './llm-gateway';

/**
 * GroqGateway (C4 L4) — calls Groq's OpenAI-compatible chat completions API.
 * Uses the global fetch (Node 18+); no extra SDK dependency.
 */
@Injectable()
export class GroqGateway implements LlmGateway {
  // Current free-tier model; override via GROQ_MODEL (e.g. openai/gpt-oss-120b).
  private readonly model = process.env.GROQ_MODEL ?? 'openai/gpt-oss-20b';
  private readonly timeoutMs = 10_000;

  constructor(private readonly apiKey: string) {}

  async complete(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content ?? '';
    } finally {
      clearTimeout(timer);
    }
  }
}
