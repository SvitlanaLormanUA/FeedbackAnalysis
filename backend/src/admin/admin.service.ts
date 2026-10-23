import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * AdminService — read models for the dashboard: the list of reviews with their
 * sentiment, aspects and date (C4 L4: Admin Controller → Repository Layer).
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listReviews(venueId: string, page = 1, pageSize = 20) {
    const skip = (Math.max(page, 1) - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.feedback.findMany({
        where: { venueId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { analysis: { include: { aspects: true } } },
      }),
      this.prisma.feedback.count({ where: { venueId } }),
    ]);

    return {
      page,
      pageSize,
      total,
      items: items.map((f) => ({
        id: f.id,
        rating: f.rating,
        comment: f.comment,
        status: f.status,
        createdAt: f.createdAt,
        tableLabel: this.extractTableLabel(f.qrCodeId, f.venueId),
        sentiment: f.analysis?.sentiment ?? null,
        isCritical: f.analysis?.isCritical ?? false,
        aspects:
          f.analysis?.aspects.map((a) => ({
            category: a.category,
            sentiment: a.sentiment,
            quote: a.quote,
          })) ?? [],
      })),
    };
  }

  private extractTableLabel(qrCodeId: string, venueId: string): string | null {
    if (!qrCodeId) return null;
    const prefix = `${venueId}:`;
    const raw = qrCodeId.startsWith(prefix)
      ? qrCodeId.slice(prefix.length)
      : qrCodeId.includes(':')
        ? qrCodeId.slice(qrCodeId.indexOf(':') + 1)
        : null;
    if (!raw || raw === 'default') return null;
    return raw;
  }
}
