import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CreateItemQueue } from './create-item-queue.js';
import { DataRequestQueue } from './data-request-queue.js';

const TEST_INTERVAL_MS = 60_000;

test('data queue processes requests in order', async () => {
  const queue = new DataRequestQueue(TEST_INTERVAL_MS);

  const executionOrder: number[] = [];

  const first = queue.enqueue(() => {
    executionOrder.push(1);
    return 1;
  });

  const second = queue.enqueue(() => {
    executionOrder.push(2);
    return 2;
  });

  assert.deepEqual(executionOrder, []);

  await queue.flush();

  assert.deepEqual(executionOrder, [1, 2]);
  assert.equal(await first, 1);
  assert.equal(await second, 2);

  await queue.shutdown();
});

test('data queue deduplicates consecutive equal operations', async () => {
  const queue = new DataRequestQueue(TEST_INTERVAL_MS);

  let executionCount = 0;

  const first = queue.enqueue(
    () => {
      executionCount += 1;
      return 42;
    },
    'select-item:42',
  );

  const duplicate = queue.enqueue(
    () => {
      executionCount += 1;
      return 42;
    },
    'select-item:42',
  );

  assert.strictEqual(first, duplicate);

  await queue.flush();

  assert.equal(await first, 42);
  assert.equal(await duplicate, 42);
  assert.equal(executionCount, 1);

  await queue.shutdown();
});

test('data queue preserves select remove select sequence', async () => {
  const queue = new DataRequestQueue(TEST_INTERVAL_MS);

  const operations: string[] = [];

  queue.enqueue(
    () => {
      operations.push('select');
    },
    'select-item:42',
  );

  queue.enqueue(
    () => {
      operations.push('remove');
    },
    'remove-selected-item:42',
  );

  queue.enqueue(
    () => {
      operations.push('select');
    },
    'select-item:42',
  );

  await queue.flush();

  assert.deepEqual(operations, [
    'select',
    'remove',
    'select',
  ]);

  await queue.shutdown();
});

test('create queue deduplicates the same id across pending requests', async () => {
  const queue = new CreateItemQueue(TEST_INTERVAL_MS);

  let executionCount = 0;

  const first = queue.enqueue(1_500_000, () => {
    executionCount += 1;
    return 1_500_000;
  });

  const anotherItem = queue.enqueue(1_600_000, () => {
    executionCount += 1;
    return 1_600_000;
  });

  const duplicate = queue.enqueue(1_500_000, () => {
    executionCount += 1;
    return 1_500_000;
  });

  assert.strictEqual(first, duplicate);

  await queue.flush();

  assert.equal(await first, 1_500_000);
  assert.equal(await duplicate, 1_500_000);
  assert.equal(await anotherItem, 1_600_000);
  assert.equal(executionCount, 2);

  await queue.shutdown();
});

test('queue continues processing after an operation error', async () => {
  const queue = new DataRequestQueue(TEST_INTERVAL_MS);

  const failedRequest = queue.enqueue(() => {
    throw new Error('Test error');
  });

  const failedAssertion = assert.rejects(
    failedRequest,
    /Test error/,
  );

  const successfulRequest = queue.enqueue(() => 100);

  await queue.flush();

  await failedAssertion;
  assert.equal(await successfulRequest, 100);

  await queue.shutdown();
});

test('shutdown flushes pending requests and rejects new ones', async () => {
  const queue = new DataRequestQueue(TEST_INTERVAL_MS);

  const pendingRequest = queue.enqueue(() => 42);

  await queue.shutdown();

  assert.equal(await pendingRequest, 42);

  await assert.rejects(
    queue.enqueue(() => 100),
    /queue is stopped/,
  );
});