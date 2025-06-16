import express from 'express';
import swaggerUi from 'swagger-ui-express';
import cors from 'cors';

import indexRouter from './src/routes/index.js';
import requestLogger from './src/middlewares/requestLogger.js';
import swaggerSpec from './src/docs/swagger.js';
import cookieParser from 'cookie-parser';

const app = express();

app.use(cors({ origin: true, credentials: true }));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(requestLogger);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/', indexRouter);

export default app;
