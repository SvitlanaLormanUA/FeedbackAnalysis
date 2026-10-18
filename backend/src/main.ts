import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const origins = config.get<string[]>('corsOrigins', ['http://localhost:5173']);
  app.enableCors({ origin: origins, credentials: true });

  const port = config.get<number>('port', 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`FeedbackAnalytics backend listening on :${port}`, 'Bootstrap');
}

void bootstrap();
