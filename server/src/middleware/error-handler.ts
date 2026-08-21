import type { ErrorRequestHandler } from 'express';

import { HttpError } from '../errors/http-error.js';
import { ItemsServiceError } from '../services/items.service.js';

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      error: error.message,
    });

    return;
  }

  if (error instanceof ItemsServiceError) {
    switch (error.code) {
      case 'ITEM_ALREADY_EXISTS':
        response.status(409).json({
          error: error.message,
        });
        return;

      case 'INVALID_ID':
      case 'INVALID_LIMIT':
      case 'INVALID_SEARCH':
      case 'INVALID_CURSOR':
        response.status(400).json({
          error: error.message,
        });
        return;
    }
  }

  console.error(error);

  response.status(500).json({
    error: 'Internal server error',
  });
};