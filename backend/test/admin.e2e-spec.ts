import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AdminController } from '../src/admin/admin.controller';
import { AdminService } from '../src/admin/admin.service';
import { StatisticsService } from '../src/admin/statistics.service';
import { QrService } from '../src/feedback/qr.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Integration test for the guarded admin dashboard routes. Boots the real
 * AdminController behind the JWT auth guard (passport strategy) with
 * AdminService / StatisticsService / QrService wired in; only Prisma is faked.
 */
describe('Admin dashboard (integration)', () => {
  let app: INestApplication<App>;
  let token: string;

  const prisma = {
    feedback: {
      aggregate: jest.fn().mockResolvedValue({ _count: 12, _avg: { rating: 4.3333 } }),
      count: jest.fn().mockResolvedValue(2),
      findMany: jest.fn().mockResolvedValue([
        {
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
        },
      ]),
    },
  };

  const config = {
    get: (key: string, def?: unknown) => {
      if (key === 'jwt.secret') return 'test-jwt-secret';
      if (key === 'qrSigningSecret') return 'test-qr-secret';
      if (key === 'corsOrigins') return ['https://app.example.com'];
      return def;
    },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: 'test-jwt-secret' })],
      controllers: [AdminController],
      providers: [
        AdminService,
        StatisticsService,
        QrService,
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const jwt = moduleRef.get(JwtService);
    token = jwt.sign({ sub: 'admin-1', email: 'admin@example.com', venueId: 'venue-1' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an unauthenticated request with 401', async () => {
    await request(app.getHttpServer()).get('/api/stats').expect(401);
  });

  it('returns venue statistics for an authenticated admin', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({
      venueId: 'venue-1',
      totalFeedback: 12,
      averageRating: 4.33,
      criticalCount: 2,
    });
  });

  it('returns a mapped, paginated list of reviews', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reviews?page=1&pageSize=5')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({ page: 1, pageSize: 5, total: 2 });
    expect(res.body.items[0]).toMatchObject({
      id: 'fb-1',
      tableLabel: '7',
      sentiment: 'NEGATIVE',
      isCritical: true,
    });
  });

  it('mints a signed QR token and guest URL that round-trips', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/qr?table=5')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.url).toContain('https://app.example.com/feedback?token=');
    const qr = (app as unknown as { get: (t: typeof QrService) => QrService }).get(QrService);
    const ctx = qr.resolveToken(res.body.token);
    expect(ctx.venueId).toBe('venue-1');
    expect(ctx.tableLabel).toBe('5');
  });

  it('returns 400 when the admin is not assigned to a venue', async () => {
    const jwt = app.get(JwtService);
    const noVenue = jwt.sign({ sub: 'admin-2', email: 'x@y.z', venueId: null });

    await request(app.getHttpServer())
      .get('/api/stats')
      .set('Authorization', `Bearer ${noVenue}`)
      .expect(400);
  });
});
