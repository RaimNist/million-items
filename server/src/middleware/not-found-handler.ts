import type { RequestHandler } from 'express';

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({
    error: {
      message: 'Route not found',
    },
  });
};
