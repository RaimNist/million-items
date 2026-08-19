import express from 'express';

import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found-handler.js';

const JSON_BODY_LIMIT = '10kb';

export const app = express();

app.use(express.json({ limit: JSON_BODY_LIMIT }));

app.get('/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
  });
});

app.use(notFoundHandler);

app.use(errorHandler);
