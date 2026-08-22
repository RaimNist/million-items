import { createApp } from './app.js';
import { CreateItemQueue } from './queues/create-item-queue.js';
import { DataRequestQueue } from './queues/data-request-queue.js';

const DEFAULT_PORT = 3000;
const HOST = '0.0.0.0';
const SHUTDOWN_TIMEOUT_MS = 10_000;

const resolvePort = (value: string | undefined): number => {
  if (value === undefined) {
    return DEFAULT_PORT;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const port = Number(value);

  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
};

const dataRequestQueue = new DataRequestQueue();
const createItemQueue = new CreateItemQueue();

const app = createApp({
  dataRequestQueue,
  createItemQueue,
});

const port = resolvePort(process.env.PORT);

const server = app.listen(port, HOST);

server.once('listening', () => {
  console.log(`Server is listening on http://${HOST}:${port}`);
});

server.once('error', (error) => {
  console.error('Failed to start HTTP server', error);
  process.exitCode = 1;
});

let isShuttingDown = false;

const shutdown = (signal: NodeJS.Signals): void => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`${signal} received. Starting graceful shutdown`);

  dataRequestQueue.shutdown();
  createItemQueue.shutdown();

  const shutdownTimeout = setTimeout(() => {
    console.error('Graceful shutdown timed out. Closing remaining connections');

    server.closeAllConnections();
    process.exitCode = 1;
  }, SHUTDOWN_TIMEOUT_MS);

  shutdownTimeout.unref();

  server.close((error) => {
    clearTimeout(shutdownTimeout);

    if (error) {
      console.error('Failed to close HTTP server', error);
      process.exitCode = 1;
      return;
    }

    console.log('HTTP server closed');
  });
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
