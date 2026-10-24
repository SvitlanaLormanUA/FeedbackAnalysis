import { StatisticsService } from './statistics.service';
import { PrismaService } from '../prisma/prisma.service';

describe('StatisticsService', () => {
  function build(aggregate: unknown, count: number) {
    const prisma = {
      feedback: {
        aggregate: jest.fn().mockResolvedValue(aggregate),
        count: jest.fn().mockResolvedValue(count),
      },
    } as unknown as PrismaService;
    return { service: new StatisticsService(prisma), prisma };
  }

  it('maps aggregate results into VenueStats', async () => {
    const { service } = build({ _count: 10, _avg: { rating: 4.256 } }, 3);

    const stats = await service.forVenue('venue-1');

    expect(stats).toEqual({
      venueId: 'venue-1',
      totalFeedback: 10,
      averageRating: 4.26,
      criticalCount: 3,
    });
  });

  it('defaults the average to 0 when there is no feedback', async () => {
    const { service } = build({ _count: 0, _avg: { rating: null } }, 0);

    const stats = await service.forVenue('empty-venue');

    expect(stats.averageRating).toBe(0);
    expect(stats.totalFeedback).toBe(0);
  });

  it('scopes both queries to the requested venue', async () => {
    const { service, prisma } = build({ _count: 1, _avg: { rating: 5 } }, 0);

    await service.forVenue('venue-42');

    expect(prisma.feedback.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { venueId: 'venue-42' } }),
    );
    expect(prisma.feedback.count).toHaveBeenCalledWith({
      where: { venueId: 'venue-42', analysis: { isCritical: true } },
    });
  });
});
