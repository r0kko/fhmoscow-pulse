import session from 'express-session';
import connectRedis from 'connect-redis';
import dotenv from 'dotenv';

import redisClient from './redis.js';
dotenv.config();
const RedisStore = connectRedis(session);
export default session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
});
