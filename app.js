import express from 'express';

import indexRouter from './src/routes/index.js';
import requestLogger from './src/middlewares/requestLogger.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(requestLogger);

app.use('/', indexRouter);

export default app;