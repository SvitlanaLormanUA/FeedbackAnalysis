import { Injectable } from '@nestjs/common';
import { Feedback, FeedbackStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnalysisOutcome } from './types';

/**
 * AnalysisResultRepository (C4 L4) — loads the feedback to analyse and persists
 * the outcome (sentiment, aspects, criticality) atomically, flipping the
 * feedback status to ANALYZED / ANALYSIS_FAILED.
 */
@Injectable()
export class AnalysisResultRepository {
  constructor(private readonly prisma: PrismaService) {}

  loadFeedback(id: string): Promise<Feedback | null> {
    return this.prisma.feedback.findUnique({ where: { id } });
  }

  async saveOutcome(feedbackId: string, outcome: AnalysisOutcome): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.analysisResult.upsert({
        where: { feedbackId },
        create: {
          feedbackId,
          sentiment: outcome.sentiment.sentiment,
          confidence: outcome.sentiment.confidence,
          conflictProbability: outcome.sentiment.conflictProbability,
          isCritical: outcome.verdict.isCritical,
          reason: outcome.verdict.reason ?? null,
          aspects: {
            create: outcome.aspects.map((a) => ({
              category: a.category,
              sentiment: a.sentiment,
              quote: a.quote ?? null,
            })),
          },
        },
        update: {
          sentiment: outcome.sentiment.sentiment,
          confidence: outcome.sentiment.confidence,
          conflictProbability: outcome.sentiment.conflictProbability,
          isCritical: outcome.verdict.isCritical,
          reason: outcome.verdict.reason ?? null,
          aspects: {
            deleteMany: {},
            create: outcome.aspects.map((a) => ({
              category: a.category,
              sentiment: a.sentiment,
              quote: a.quote ?? null,
            })),
          },
        },
      }),
      this.prisma.feedback.update({
        where: { id: feedbackId },
        data: { status: FeedbackStatus.ANALYZED },
      }),
    ]);
  }

  async markFailed(feedbackId: string): Promise<void> {
    await this.prisma.feedback.update({
      where: { id: feedbackId },
      data: { status: FeedbackStatus.ANALYSIS_FAILED },
    });
  }
}
