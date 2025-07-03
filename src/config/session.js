import session from 'express-session';
import connectRedis from 'connect-redis';
import dotenv from 'dotenv';

import redisClient from './redis.js';
dotenv.config();
function isClass(fn) {
  return typeof fn === 'function' && /^class\s/.test(Function.prototype.toString.call(fn));
}

let RedisStore = connectRedis;
if (!isClass(connectRedis)) {
  RedisStore = connectRedis(session);
}

const store = new RedisStore({ client: redisClient });
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
