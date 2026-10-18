import { Injectable } from '@nestjs/common';
import { Feedback, FeedbackStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * FeedbackRepository (C4 L4: Repository Layer) — the only place that talks to
 * the DB for feedback rows. Keeps services free of Prisma specifics.
 */
@Injectable()
export class FeedbackRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.FeedbackUncheckedCreateInput): Promise<Feedback> {
    return this.prisma.feedback.create({ data });
  }

  setStatus(id: string, status: FeedbackStatus): Promise<Feedback> {
    return this.prisma.feedback.update({ where: { id }, data: { status } });
  }

  findById(id: string): Promise<Feedback | null> {
    return this.prisma.feedback.findUnique({ where: { id } });
  }

  /** Full detail with analysis + aspects, used by the analysis worker. */
  findWithAnalysis(id: string) {
    return this.prisma.feedback.findUnique({
      where: { id },
      include: { analysis: { include: { aspects: true } } },
    });
  }

  /** Venue existence check used before accepting a review. */
  venueExists(id: string): Promise<boolean> {
    return this.prisma.venue
      .findUnique({ where: { id }, select: { id: true } })
      .then((v) => v !== null);
  }
}
