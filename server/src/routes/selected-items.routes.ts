import { Router } from 'express';

import type { SelectedItemsController } from '../controllers/selected-items.controller.js';

export const createSelectedItemsRouter = (
  selectedItemsController: SelectedItemsController,
): Router => {
  const router = Router();

  router.get('/', selectedItemsController.getItems);
  router.post('/', selectedItemsController.selectItem);
  router.delete('/:id', selectedItemsController.removeItem);
  router.patch('/order', selectedItemsController.reorderItems);

  return router;
};
