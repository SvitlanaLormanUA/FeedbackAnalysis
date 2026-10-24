import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminService', () => {
  function build(items: unknown[], total: number) {
    const prisma = {
      feedback: {
        findMany: jest.fn().mockResolvedValue(items),
        count: jest.fn().mockResolvedValue(total),
      },
    } as unknown as PrismaService;
    return { service: new AdminService(prisma), prisma };
  }

  const review = {
    id: 'fb-1',
    rating: 2,
    comment: 'cold food',
    status: 'DONE',
    createdAt: new Date('2026-01-01'),
    venueId: 'venue-1',
    qrCodeId: 'venue-1:7',
    analysis: {
      sentiment: 'NEGATIVE',
      isCritical: true,
      aspects: [{ category: 'FOOD', sentiment: 'NEGATIVE', quote: 'cold' }],
    },
  };

  it('maps a review row into the dashboard shape', async () => {
    const { service } = build([review], 1);

    const result = await service.listReviews('venue-1', 1, 20);

    expect(result).toMatchObject({ page: 1, pageSize: 20, total: 1 });
    expect(result.items[0]).toEqual({
      id: 'fb-1',
      rating: 2,
      comment: 'cold food',
      status: 'DONE',
      createdAt: review.createdAt,
      tableLabel: '7',
      sentiment: 'NEGATIVE',
      isCritical: true,
      aspects: [{ category: 'FOOD', sentiment: 'NEGATIVE', quote: 'cold' }],
    });
  });

  it('treats a "default" qr code as no table label', async () => {
    const { service } = build(
      [{ ...review, qrCodeId: 'venue-1:default' }],
      1,
    );

    const result = await service.listReviews('venue-1');
    expect(result.items[0].tableLabel).toBeNull();
  });

  it('falls back to neutral defaults when a review has no analysis yet', async () => {
    const { service } = build([{ ...review, analysis: null }], 1);

    const result = await service.listReviews('venue-1');
    expect(result.items[0].sentiment).toBeNull();
    expect(result.items[0].isCritical).toBe(false);
    expect(result.items[0].aspects).toEqual([]);
  });

  it('computes the pagination offset and scopes queries to the venue', async () => {
    const { service, prisma } = build([], 0);

    await service.listReviews('venue-9', 3, 10);

    expect(prisma.feedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { venueId: 'venue-9' }, skip: 20, take: 10 }),
    );
    expect(prisma.feedback.count).toHaveBeenCalledWith({ where: { venueId: 'venue-9' } });
  });
});
