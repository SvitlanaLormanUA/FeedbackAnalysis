import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * TelegramService (C4 L4) — thin client for the Telegram Bot API sendMessage.
 * If no bot token/chat id is configured it logs instead of sending, so the
 * system works out of the box in dev and on a free deploy.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly chatId: string;

  constructor(config: ConfigService) {
    this.botToken = config.get<string>('telegram.botToken', '');
    this.chatId = config.get<string>('telegram.chatId', '');
  }

  get enabled(): boolean {
    return Boolean(this.botToken && this.chatId);
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(`Telegram not configured — alert not sent:\n${text}`);
      return;
    }
    const res = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: this.chatId, text, parse_mode: 'HTML' }),
    });
    if (!res.ok) {
      throw new Error(`Telegram sendMessage failed: HTTP ${res.status}`);
    }
  }
}
