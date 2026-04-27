import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;
export const REDIS_ENABLED = !!REDIS_URL;

let redisClient: Redis;

if (REDIS_ENABLED) {
  redisClient = new Redis(REDIS_URL!, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 500, 10_000),
  });
  redisClient.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'ECONNREFUSED') {
      console.warn('[Redis] Connection refused — caching and background jobs disabled.');
    } else {
      console.error('[Redis] Error:', err.message);
    }
  });
  redisClient.on('ready', () => console.log('[Redis] Connected.'));
} else {
  // No REDIS_URL — use a permanently-disconnected instance that never dials out
  console.warn('[Redis] REDIS_URL not set — caching and CSV export disabled.');
  redisClient = new Redis({
    host: '127.0.0.1',
    port: 6379,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,   // null = never retry
  });
  // Suppress all errors from this stub permanently
  redisClient.on('error', () => undefined);
}

export default redisClient;
