import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import request from 'supertest';
import type { App } from 'supertest/types';
import { FeedbackController } from '../src/feedback/feedback.controller';
import { FeedbackService } from '../src/feedback/feedback.service';
import { FeedbackRepository } from '../src/feedback/feedback.repository';
import { QrService } from '../src/feedback/qr.service';
import { AnalysisTaskDispatcher } from '../src/feedback/analysis-task-dispatcher';
import { PrismaService } from '../src/prisma/prisma.service';
import { ANALYSIS_QUEUE } from '../src/analysis/types';

/**
 * Integration test for the public feedback flow. Boots the real
 * FeedbackController → FeedbackService → FeedbackRepository / QrService /
 * AnalysisTaskDispatcher wiring with DTO validation; only the DB (Prisma) and
 * the Redis queue are faked, so it needs no Docker infrastructure.
 */
describe('Feedback flow (integration)', () => {
  let app: INestApplication<App>;
  let qr: QrService;
  let prisma: { venue: { findUnique: jest.Mock }; feedback: { create: jest.Mock; update: jest.Mock } };
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    prisma = {
      venue: { findUnique: jest.fn().mockResolvedValue({ id: 'venue-1' }) },
      feedback: {
        create: jest.fn().mockResolvedValue({
          id: 'fb-1',
          venueId: 'venue-1',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
        update: jest.fn().mockResolvedValue({ id: 'fb-1' }),
      },
    };
    queue = { add: jest.fn().mockResolvedValue(undefined) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [FeedbackController],
      providers: [
        FeedbackService,
        FeedbackRepository,
        QrService,
        AnalysisTaskDispatcher,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(ANALYSIS_QUEUE), useValue: queue },
        {
          provide: ConfigService,
          useValue: { get: (key: string, def?: unknown) => (key === 'qrSigningSecret' ? 'test-secret' : def) },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    qr = moduleRef.get(QrService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts a valid review, persists it and enqueues analysis', async () => {
    const token = qr.generateToken('venue-1', 'table-3');

    const res = await request(app.getHttpServer())
      .post('/api/feedback')
      .send({ qrToken: token, rating: 1, comment: 'Dirty table and rude staff' })
      .expect(201);

    expect(res.body.id).toBe('fb-1');
    expect(prisma.feedback.create).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      'analyze',
      { feedbackId: 'fb-1', venueId: 'venue-1' },
      expect.objectContaining({ attempts: 3 }),
    );
    // status advanced to QUEUED after a successful enqueue
    expect(prisma.feedback.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'fb-1' } }),
    );
  });

  it('rejects a tampered QR token with 401', async () => {
    const token = qr.generateToken('venue-1');
    const tampered = token.slice(0, -2) + 'xy';

    await request(app.getHttpServer())
      .post('/api/feedback')
      .send({ qrToken: tampered, rating: 5 })
      .expect(401);
    expect(prisma.feedback.create).not.toHaveBeenCalled();
  });

  it('returns 404 when the venue in the token no longer exists', async () => {
    prisma.venue.findUnique.mockResolvedValueOnce(null);
    const token = qr.generateToken('venue-ghost');

    await request(app.getHttpServer())
      .post('/api/feedback')
      .send({ qrToken: token, rating: 4 })
      .expect(404);
  });

  it('rejects an out-of-range rating with 400 (DTO validation)', async () => {
    const token = qr.generateToken('venue-1');

    await request(app.getHttpServer())
      .post('/api/feedback')
      .send({ qrToken: token, rating: 9 })
      .expect(400);
  });

  it('rejects a body missing the qrToken with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/feedback')
      .send({ rating: 3 })
      .expect(400);
  });

  it('rejects unknown extra fields with 400 (whitelist)', async () => {
    const token = qr.generateToken('venue-1');

    await request(app.getHttpServer())
      .post('/api/feedback')
      .send({ qrToken: token, rating: 3, isAdmin: true })
      .expect(400);
  });

  it('still accepts the review (201) when the queue is unavailable', async () => {
    queue.add.mockRejectedValueOnce(new Error('redis down'));
    const token = qr.generateToken('venue-1');

    await request(app.getHttpServer())
      .post('/api/feedback')
      .send({ qrToken: token, rating: 2, comment: 'meh' })
      .expect(201);

    // review kept, but it was never marked QUEUED
    expect(prisma.feedback.create).toHaveBeenCalledTimes(1);
    expect(prisma.feedback.update).not.toHaveBeenCalled();
  });
});
