import session from 'express-session';
import RedisStore from 'connect-redis';
import dotenv from 'dotenv';

import redisClient from './redis.js';
dotenv.config();
const store = new RedisStore({ client: redisClient });
export default session({
  store,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
});
