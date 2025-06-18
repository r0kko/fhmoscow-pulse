import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';

import indexRouter from './src/routes/index.js';
import requestLogger from './src/middlewares/requestLogger.js';
import rateLimiter from './src/middlewares/rateLimiter.js';
import swaggerSpec from './src/docs/swagger.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));
app.use(rateLimiter);
app.use(requestLogger);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/', indexRouter);

export default app;
