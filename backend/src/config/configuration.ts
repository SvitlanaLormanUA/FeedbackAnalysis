/**
 * Centralised, typed configuration read from environment variables.
 * Loaded by @nestjs/config in AppModule.
 */
export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  redisUrl: string;
  runWorker: boolean;
  jwt: { secret: string; expiresIn: string };
  qrSigningSecret: string;
  llm: {
    provider: 'gemini' | 'groq' | 'mock';
    geminiApiKey: string;
    groqApiKey: string;
  };
  telegram: { botToken: string; chatId: string };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  runWorker: (process.env.RUN_WORKER ?? 'true') === 'true',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
  qrSigningSecret: process.env.QR_SIGNING_SECRET ?? 'change-me-qr-secret',
  llm: {
    provider: (process.env.LLM_PROVIDER as AppConfig['llm']['provider']) ?? 'mock',
    geminiApiKey: process.env.GEMINI_API_KEY ?? '',
    groqApiKey: process.env.GROQ_API_KEY ?? '',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    chatId: process.env.TELEGRAM_CHAT_ID ?? '',
  },
});
