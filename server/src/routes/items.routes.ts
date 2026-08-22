import { Router } from 'express';

import type { ItemsController } from '../controllers/items.controller.js';

export const createItemsRouter = (itemsController: ItemsController): Router => {
  const router = Router();

  router.get('/', itemsController.getItems);
  router.post('/', itemsController.createItem);

  return router;
};
