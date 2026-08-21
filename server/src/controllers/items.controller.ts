import type { Request, Response } from 'express';

import { HttpError } from '../errors/http-error.js';
import type { CreateItemQueue } from '../queues/create-item-queue.js';
import type { DataRequestQueue } from '../queues/data-request-queue.js';
import {
  createCustomItem,
  getAvailableItems,
} from '../services/items.service.js';

const parseLimit = (value: unknown): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== 'string' ||
    !/^\d+$/.test(value)
  ) {
    throw new HttpError(
      400,
      'Limit must be a positive integer',
    );
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
    throw new HttpError(
      400,
      'Search must be a string',
    );
  }

  return value;
};

const parseItemId = (value: unknown): number => {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value)
  ) {
    throw new HttpError(
      400,
      'ID must be a safe integer',
    );
  }

  return value;
};

export class ItemsController {
  constructor(
    private readonly dataRequestQueue: DataRequestQueue,
    private readonly createItemQueue: CreateItemQueue,
  ) {}

  getItems = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    const limit = parseLimit(request.query.limit);
    const cursor = parseCursor(request.query.cursor);
    const search = parseSearch(request.query.search);

    const result = await this.dataRequestQueue.enqueue(() =>
      getAvailableItems({
        limit,
        cursor,
        search,
      }),
    );

    response.status(200).json(result);
  };

  createItem = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    const id = parseItemId(request.body?.id);

    const createdId = await this.createItemQueue.enqueue(
      id,
      () => createCustomItem(id),
    );

    response.status(201).json({
      id: createdId,
    });
  };
}