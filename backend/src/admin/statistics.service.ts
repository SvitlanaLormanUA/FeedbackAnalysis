import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface VenueStats {
  venueId: string;
  totalFeedback: number;
  averageRating: number;
  criticalCount: number;
}

/**
 * StatisticsService (C4 L4) — basic dashboard metrics: number of reviews and
 * the venue's average rating.
 */
@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async forVenue(venueId: string): Promise<VenueStats> {
    const [agg, criticalCount] = await Promise.all([
      this.prisma.feedback.aggregate({
        where: { venueId },
        _count: true,
        _avg: { rating: true },
      }),
      this.prisma.feedback.count({
        where: { venueId, analysis: { isCritical: true } },
      }),
    ]);

    return {
      venueId,
      totalFeedback: agg._count,
      averageRating: Number((agg._avg.rating ?? 0).toFixed(2)),
      criticalCount,
    };
  }
}
