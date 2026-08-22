import type { Request, Response } from 'express';

import { HttpError } from '../errors/http-error.js';
import type { DataRequestQueue } from '../queues/data-request-queue.js';
import {
  getSelectedItems,
  removeSelectedItem,
  reorderSelectedItems,
  selectItem,
} from '../services/selected-items.service.js';

const parseItemId = (value: unknown): number => {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    const id = Number(value);

    if (Number.isSafeInteger(id)) {
      return id;
    }
  }

  throw new HttpError(400, 'ID must be a safe integer');
};

const parseOrderIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'IDs must be an array');
  }

  if (!value.every((id) => typeof id === 'number' && Number.isSafeInteger(id))) {
    throw new HttpError(400, 'Every ID must be a safe integer');
  }

  return value;
};

const parseLimit = (value: unknown): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new HttpError(400, 'Limit must be a positive integer');
  }

  return Number(value);
};

const parseCursor = (value: unknown): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.length === 0) {
    throw new HttpError(400, 'Cursor is invalid');
  }

  return value;
};

const parseSearch = (value: unknown): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new HttpError(400, 'Search must be a string');
  }

  return value;
};

export class SelectedItemsController {
  constructor(private readonly dataRequestQueue: DataRequestQueue) {}

  getItems = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    const limit = parseLimit(request.query.limit);
    const cursor = parseCursor(request.query.cursor);
    const search = parseSearch(request.query.search);

    const result = await this.dataRequestQueue.enqueue(() =>
      getSelectedItems({
        limit,
        cursor,
        search,
      }),
    );

    response.status(200).json(result);
  };

  selectItem = async (request: Request, response: Response): Promise<void> => {
    const id = parseItemId(request.body?.id);

    const selectedId = await this.dataRequestQueue.enqueue(
      () => selectItem(id),
      `select-item:${id}`,
    );

    response.status(201).json({
      id: selectedId,
    });
  };

  removeItem = async (request: Request, response: Response): Promise<void> => {
    const id = parseItemId(request.params.id);

    const removedId = await this.dataRequestQueue.enqueue(
      () => removeSelectedItem(id),
      `remove-selected-item:${id}`,
    );

    response.status(200).json({
      id: removedId,
    });
  };

  reorderItems = async (request: Request, response: Response): Promise<void> => {
    const ids = parseOrderIds(request.body?.ids);

    const items = await this.dataRequestQueue.enqueue(() => reorderSelectedItems(ids));

    response.status(200).json({
      items,
    });
  };
}
