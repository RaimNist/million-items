import express from 'express';

import { ItemsController } from './controllers/items.controller.js';
import { SelectedItemsController } from './controllers/selected-items.controller.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found-handler.js';
import { CreateItemQueue } from './queues/create-item-queue.js';
import { DataRequestQueue } from './queues/data-request-queue.js';
import { createItemsRouter } from './routes/items.routes.js';
import { createSelectedItemsRouter } from './routes/selected-items.routes.js';

interface AppDependencies {
  dataRequestQueue: DataRequestQueue;
  createItemQueue: CreateItemQueue;
}

export const createApp = ({ dataRequestQueue, createItemQueue }: AppDependencies) => {
  const app = express();

  const itemsController = new ItemsController(dataRequestQueue, createItemQueue);
  const selectedItemsController = new SelectedItemsController(dataRequestQueue);

  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.status(200).json({
      status: 'ok',
    });
  });

  app.use('/api/items', createItemsRouter(itemsController));
  app.use('/api/selected-items', createSelectedItemsRouter(selectedItemsController));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
