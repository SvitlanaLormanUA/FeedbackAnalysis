import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { FeedbackRepository } from './feedback.repository';
import { QrService } from './qr.service';
import { AnalysisTaskDispatcher } from './analysis-task-dispatcher';
import { ANALYSIS_QUEUE } from '../analysis/types';

@Module({
  imports: [BullModule.registerQueue({ name: ANALYSIS_QUEUE })],
  controllers: [FeedbackController],
  providers: [FeedbackService, FeedbackRepository, QrService, AnalysisTaskDispatcher],
  exports: [FeedbackRepository, QrService],
})
export class FeedbackModule {}
