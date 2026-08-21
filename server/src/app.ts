import express from 'express';

import { ItemsController } from './controllers/items.controller.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found-handler.js';
import { CreateItemQueue } from './queues/create-item-queue.js';
import { DataRequestQueue } from './queues/data-request-queue.js';
import { createItemsRouter } from './routes/items.routes.js';

export const app = express();

const dataRequestQueue = new DataRequestQueue();
const createItemQueue = new CreateItemQueue();

const itemsController = new ItemsController(
  dataRequestQueue,
  createItemQueue,
);

app.use(express.json());

app.get('/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
  });
});

app.use(
  '/api/items',
  createItemsRouter(itemsController),
);

app.use(notFoundHandler);
app.use(errorHandler);