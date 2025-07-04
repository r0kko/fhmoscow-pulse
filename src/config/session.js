import session from 'express-session';
import { RedisStore } from 'connect-redis';
import dotenv from 'dotenv';

import redisClient, { isRedisWritable } from './redis.js';
dotenv.config();

let store;
if (isRedisWritable()) {
  store = new RedisStore({ client: redisClient });
} else {
  const { MemoryStore } = session;
  store = new MemoryStore();
}

export default session({
  store,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
});
