import { createClient } from 'redis';
import './env.js';

const url =
  process.env.REDIS_URL ||
  `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
let redisWritable = true;
const client = createClient({ url });

client.on('error', (err) => {
  console.error('Redis Client Error', err);
  if (err?.message?.includes('READONLY')) {
    redisWritable = false;
  }
  import('./metrics.js').then((m) => m.setCacheUp?.(false)).catch(() => {});
});

export async function connectRedis() {
  const { default: logger } = await import('../../logger.js');
  try {
    await client.connect();
    logger.info('✅ Redis connection established');
    import('./metrics.js').then((m) => m.setCacheUp?.(true)).catch(() => {});
  } catch (err) {
    logger.error('❌ Unable to connect to Redis:', err);
    import('./metrics.js').then((m) => m.setCacheUp?.(false)).catch(() => {});
    const error = new Error('Unable to connect to Redis');
    error.cause = err;
    throw error;
  }
}

export async function closeRedis() {
  await client.quit();
}
export function isRedisWritable() {
  return redisWritable;
}

export default client;
