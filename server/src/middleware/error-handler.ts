import type { ErrorRequestHandler } from 'express';

type ErrorWithStatus = Error & {
  status: number;
};

const hasHttpStatus = (error: unknown): error is ErrorWithStatus => {
  if (!(error instanceof Error) || !('status' in error)) {
    return false;
  }

  return typeof error.status === 'number' && error.status >= 400 && error.status < 500;
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (hasHttpStatus(error)) {
    const message = error.status === 413 ? 'Request body is too large' : 'Invalid request body';

    response.status(error.status).json({
      error: {
        message,
      },
    });

    return;
  }

  console.error(error);

  response.status(500).json({
    error: {
      message: 'Internal server error',
    },
  });
};
