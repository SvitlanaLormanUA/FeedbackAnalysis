import { RedisOptions } from 'ioredis';

/**
 * Parses a REDIS_URL (redis:// or rediss://) into ioredis options for BullMQ.
 * Handles TLS (Upstash, Render Key Value) and sets maxRetriesPerRequest=null,
 * which BullMQ requires for blocking worker connections.
 */
export function redisConnection(url: string): RedisOptions {
  const parsed = new URL(url);
  const options: RedisOptions = {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    maxRetriesPerRequest: null,
  };
  if (parsed.username) options.username = decodeURIComponent(parsed.username);
  if (parsed.password) options.password = decodeURIComponent(parsed.password);
  if (parsed.protocol === 'rediss:') options.tls = {};
  return options;
}
