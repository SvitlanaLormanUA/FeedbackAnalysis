import { Module, Provider } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_QUEUE } from './types';
import { TextPreprocessor } from './text-preprocessor';
import { SentimentClassifier } from './sentiment-classifier';
import { AspectExtractor } from './aspect-extractor';
import { CriticalityDetector } from './criticality-detector';
import { AnalysisResultRepository } from './analysis-result.repository';
import { FeedbackAnalysisProcessor } from './feedback-analysis.processor';
import { NotificationsModule } from '../notifications/notifications.module';
import { LLM_GATEWAY, LlmGateway } from './llm/llm-gateway';
import { GeminiGateway } from './llm/gemini.gateway';
import { GroqGateway } from './llm/groq.gateway';
import { MockGateway } from './llm/mock.gateway';

const llmProvider: Provider = {
  provide: LLM_GATEWAY,
  inject: [ConfigService],
  useFactory: (config: ConfigService): LlmGateway => {
    const provider = config.get<string>('llm.provider', 'mock');
    const geminiKey = config.get<string>('llm.geminiApiKey', '');
    const groqKey = config.get<string>('llm.groqApiKey', '');
    if (provider === 'gemini' && geminiKey) return new GeminiGateway(geminiKey);
    if (provider === 'groq' && groqKey) return new GroqGateway(groqKey);
    return new MockGateway();
  },
};

// Run the worker in-process unless explicitly disabled (lets one Render service
// host both the API and the analysis worker on the free tier).
const runWorker = (process.env.RUN_WORKER ?? 'true') === 'true';

@Module({
  imports: [
    BullModule.registerQueue({ name: ANALYSIS_QUEUE }),
    NotificationsModule,
  ],
  providers: [
    llmProvider,
    TextPreprocessor,
    SentimentClassifier,
    AspectExtractor,
    CriticalityDetector,
    AnalysisResultRepository,
    ...(runWorker ? [FeedbackAnalysisProcessor] : []),
  ],
})
export class AnalysisModule {}
