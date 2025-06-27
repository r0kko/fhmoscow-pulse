import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
const client = createClient({ url });

client.on('error', (err) => {
  console.error('Redis Client Error', err);
});

export async function connectRedis() {
  const { default: logger } = await import('../../logger.js');
  try {
    await client.connect();
    logger.info('✅ Redis connection established');
  } catch (err) {
    logger.error('❌ Unable to connect to Redis:', err);
    process.exit(1);
  }
}

export async function closeRedis() {
  await client.quit();
}

export default client;
