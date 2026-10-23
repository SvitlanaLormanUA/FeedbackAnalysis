import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { CriticalFeedbackEvent } from '../analysis/types';

/**
 * AlertDispatcher (C4 L4) — formats a critical-review alert (rating, text, time)
 * and delivers it via Telegram, logging the attempt in the DB.
 */
@Injectable()
export class AlertDispatcher {
  private readonly logger = new Logger(AlertDispatcher.name);

  constructor(
    private readonly telegram: TelegramService,
    private readonly prisma: PrismaService,
  ) {}

  async dispatch(event: CriticalFeedbackEvent): Promise<void> {
    const message = this.format(event);

    let deliveredAt: Date | null = null;
    try {
      await this.telegram.sendMessage(message);
      deliveredAt = new Date();
    } catch (err) {
      this.logger.error(`Failed to deliver alert for ${event.feedbackId}`, err as Error);
    }

    await this.prisma.alert.upsert({
      where: { feedbackId: event.feedbackId },
      create: {
        feedbackId: event.feedbackId,
        venueId: event.venueId,
        rating: event.rating,
        comment: event.comment ?? null,
        receivedAt: event.receivedAt,
        deliveredAt,
      },
      update: { deliveredAt },
    });
  }

  private format(event: CriticalFeedbackEvent): string {
    const when = event.receivedAt.toISOString().replace('T', ' ').slice(0, 19);
    return [
      '🚨 <b>Critical review</b>',
      `⭐ Rating: <b>${event.rating}/5</b>`,
      event.tableLabel ? `📍 Table: <b>${this.escape(event.tableLabel)}</b>` : null,
      event.reason ? `⚠️ Reason: ${event.reason}` : null,
      event.comment ? `💬 ${this.escape(event.comment)}` : '💬 (no comment)',
      `🕒 ${when} UTC`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private escape(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
