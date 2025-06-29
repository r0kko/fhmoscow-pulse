import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import helmet from 'helmet';
import lusca from 'lusca';

import session from './src/config/session.js';
import indexRouter from './src/routes/index.js';
import requestLogger from './src/middlewares/requestLogger.js';
import rateLimiter from './src/middlewares/rateLimiter.js';
import swaggerSpec from './src/docs/swagger.js';
import { ALLOWED_ORIGINS } from './src/config/cors.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(rateLimiter);
app.use(session);
app.use(lusca.csrf());
app.use(requestLogger);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/', indexRouter);


export default app;
