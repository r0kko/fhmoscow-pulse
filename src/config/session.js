import session from 'express-session';
import { RedisStore } from 'connect-redis';

import './env.js';
import { isSecureEnv, cookieSameSite, cookieDomain } from './security.js';
import redisClient, { isRedisWritable } from './redis.js';

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
    secure: isSecureEnv(),
    sameSite: cookieSameSite(),
    domain: cookieDomain(),
  },
});
