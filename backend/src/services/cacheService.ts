import redisClient from '../config/redis';

function isRedisReady(): boolean {
  return redisClient.status === 'ready';
}

export const CacheService = {
  async get<T>(key: string): Promise<T | null> {
    if (!isRedisReady()) return null;
    try {
      const data = await redisClient.get(key);
      return data ? (JSON.parse(data) as T) : null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
    if (!isRedisReady()) return;
    try {
      await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
    } catch {
      // silently skip — cache is a performance optimisation, not a hard requirement
    }
  },

  async del(key: string): Promise<void> {
    if (!isRedisReady()) return;
    try {
      await redisClient.del(key);
    } catch { /* ignore */ }
  },

  async invalidateByPattern(pattern: string): Promise<void> {
    if (!isRedisReady()) return;
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redisClient.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } while (cursor !== '0');
    } catch { /* ignore */ }
  },
};

// TTL constants (seconds)
export const TTL = {
  USER_PROFILE:      12 * 60 * 60,   // 12 hours
  DEPARTMENT_TREE:   24 * 60 * 60,   // 24 hours
  TEMPLATE_MATRIX:   24 * 60 * 60,   // 24 hours
  GLOBAL_MATRIX:     24 * 60 * 60,   // 24 hours
} as const;

// Key builders
export const CacheKeys = {
  userProfile:      (id: string) => `user:${id}:profile`,
  departmentTree:   (id: string) => `org:department:${id}:tree`,
  templateMatrix:   (id: string) => `matrix:template:${id}`,
  globalMatrix:     ()           => `matrix:global`,
  approversList:    (deptId: string) => `approvers:department:${deptId}`,
};
