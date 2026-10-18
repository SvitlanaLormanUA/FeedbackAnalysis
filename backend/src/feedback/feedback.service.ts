import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FeedbackStatus } from '@prisma/client';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackAcceptedDto } from './dto/feedback-accepted.dto';
import { FeedbackRepository } from './feedback.repository';
import { QrService } from './qr.service';
import { AnalysisTaskDispatcher } from './analysis-task-dispatcher';

/**
 * FeedbackService (C4 L4) — validates the QR token, stores the review with its
 * timestamp, then enqueues the analysis job. Mirrors the numbered calls:
 *   1: resolveToken  2: create  3: enqueue  4: setStatus(QUEUED)
 */
@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    private readonly qrService: QrService,
    private readonly repo: FeedbackRepository,
    private readonly dispatcher: AnalysisTaskDispatcher,
  ) {}

  async create(dto: CreateFeedbackDto): Promise<FeedbackAcceptedDto> {
    // 1. Resolve + validate the signed QR token.
    const ctx = this.qrService.resolveToken(dto.qrToken);

    if (!(await this.repo.venueExists(ctx.venueId))) {
      throw new NotFoundException('Venue not found');
    }

    // 2. Persist the review (status RECEIVED, createdAt set by the DB).
    const feedback = await this.repo.create({
      venueId: ctx.venueId,
      qrCodeId: ctx.qrCodeId,
      rating: dto.rating,
      comment: dto.comment ?? null,
      status: FeedbackStatus.RECEIVED,
    });

    // 3. Enqueue analysis + 4. mark as QUEUED. If the queue is unavailable we
    // still keep the review; it can be re-analyzed later.
    try {
      await this.dispatcher.enqueue({
        feedbackId: feedback.id,
        venueId: feedback.venueId,
      });
      await this.repo.setStatus(feedback.id, FeedbackStatus.QUEUED);
    } catch (err) {
      this.logger.error(`Failed to enqueue analysis for ${feedback.id}`, err as Error);
    }

    return new FeedbackAcceptedDto(feedback.id, feedback.createdAt);
  }
}
