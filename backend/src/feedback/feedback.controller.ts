import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackAcceptedDto } from './dto/feedback-accepted.dto';
import { FeedbackService } from './feedback.service';

/**
 * FeedbackController (C4 L4) — public endpoint. No authentication: guests post
 * reviews using only a valid signed QR token.
 */
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @HttpCode(201)
  submit(@Body() dto: CreateFeedbackDto): Promise<FeedbackAcceptedDto> {
    return this.feedbackService.create(dto);
  }
}
