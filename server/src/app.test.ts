import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';

import { createApp } from './app.js';
import { CreateItemQueue } from './queues/create-item-queue.js';
import { DataRequestQueue } from './queues/data-request-queue.js';
import { itemsState } from './state/items-state.js';

test('GET /health returns ok status', async (t) => {
  const dataRequestQueue = new DataRequestQueue(60_000);
  const createItemQueue = new CreateItemQueue(60_000);

  const app = createApp({
    dataRequestQueue,
    createItemQueue,
  });

  const server = app.listen(0, '127.0.0.1');

  t.after(async () => {
    server.close();
    await dataRequestQueue.shutdown();
    await createItemQueue.shutdown();
  });

  await once(server, 'listening');

  const address = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${address.port}/health`);
  const body: unknown = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    status: 'ok',
  });
});

test('GET /api/items returns requested page of available items', async (t) => {
  const dataRequestQueue = new DataRequestQueue(1);
  const createItemQueue = new CreateItemQueue(60_000);

  const app = createApp({
    dataRequestQueue,
    createItemQueue,
  });

  const server = app.listen(0, '127.0.0.1');

  t.after(async () => {
    server.close();
    await dataRequestQueue.shutdown();
    await createItemQueue.shutdown();
  });

  await once(server, 'listening');

  const address = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${address.port}/api/items?limit=3`);

  const body = (await response.json()) as {
    items: number[];
    nextCursor: string | null;
    hasMore: boolean;
  };

  assert.equal(response.status, 200);
  assert.deepEqual(body.items, [1, 2, 3]);
  assert.equal(typeof body.nextCursor, 'string');
  assert.equal(body.hasMore, true);
});

test('GET /api/items returns next page without duplicates', async (t) => {
  const dataRequestQueue = new DataRequestQueue(1);
  const createItemQueue = new CreateItemQueue(60_000);

  const app = createApp({
    dataRequestQueue,
    createItemQueue,
  });

  const server = app.listen(0, '127.0.0.1');

  t.after(async () => {
    server.close();
    await dataRequestQueue.shutdown();
    await createItemQueue.shutdown();
  });

  await once(server, 'listening');

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const firstResponse = await fetch(`${baseUrl}/api/items?limit=3`);

  const firstBody = (await firstResponse.json()) as {
    items: number[];
    nextCursor: string | null;
    hasMore: boolean;
  };

  assert.equal(firstResponse.status, 200);
  assert.deepEqual(firstBody.items, [1, 2, 3]);
  assert.notEqual(firstBody.nextCursor, null);

  const secondResponse = await fetch(
    `${baseUrl}/api/items?limit=3&cursor=${encodeURIComponent(firstBody.nextCursor!)}`,
  );

  const secondBody = (await secondResponse.json()) as {
    items: number[];
    nextCursor: string | null;
    hasMore: boolean;
  };

  assert.equal(secondResponse.status, 200);
  assert.deepEqual(secondBody.items, [4, 5, 6]);
  assert.equal(secondBody.hasMore, true);

  const duplicates = firstBody.items.filter((id) => secondBody.items.includes(id));

  assert.deepEqual(duplicates, []);
});

test('GET /api/items paginates filtered items by search prefix', async (t) => {
  const dataRequestQueue = new DataRequestQueue(1);
  const createItemQueue = new CreateItemQueue(60_000);

  const app = createApp({
    dataRequestQueue,
    createItemQueue,
  });

  const server = app.listen(0, '127.0.0.1');

  t.after(async () => {
    server.close();
    await dataRequestQueue.shutdown();
    await createItemQueue.shutdown();
  });

  await once(server, 'listening');

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const firstResponse = await fetch(`${baseUrl}/api/items?limit=3&search=12`);

  const firstBody = (await firstResponse.json()) as {
    items: number[];
    nextCursor: string | null;
    hasMore: boolean;
  };

  assert.equal(firstResponse.status, 200);
  assert.deepEqual(firstBody.items, [12, 120, 121]);
  assert.notEqual(firstBody.nextCursor, null);
  assert.equal(firstBody.hasMore, true);

  const secondResponse = await fetch(
    `${baseUrl}/api/items?limit=3&search=12&cursor=${encodeURIComponent(firstBody.nextCursor!)}`,
  );

  const secondBody = (await secondResponse.json()) as {
    items: number[];
    nextCursor: string | null;
    hasMore: boolean;
  };

  assert.equal(secondResponse.status, 200);
  assert.deepEqual(secondBody.items, [122, 123, 124]);
  assert.equal(secondBody.hasMore, true);

  assert.equal(
    [...firstBody.items, ...secondBody.items].every((id) => String(id).startsWith('12')),
    true,
  );
});

test('POST /api/items creates custom item and makes it available', async (t) => {
  const customId = 1_000_001;

  const dataRequestQueue = new DataRequestQueue(1);
  const createItemQueue = new CreateItemQueue(1);

  const app = createApp({
    dataRequestQueue,
    createItemQueue,
  });

  const server = app.listen(0, '127.0.0.1');

  t.after(async () => {
    server.close();

    await dataRequestQueue.shutdown();
    await createItemQueue.shutdown();

    const customIdIndex = itemsState.customIds.indexOf(customId);

    if (customIdIndex !== -1) {
      itemsState.customIds.splice(customIdIndex, 1);
    }

    itemsState.customIdsSet.delete(customId);
  });

  await once(server, 'listening');

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const createResponse = await fetch(`${baseUrl}/api/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: customId,
    }),
  });

  const createBody = (await createResponse.json()) as {
    id: number;
  };

  assert.equal(createResponse.status, 201);
  assert.deepEqual(createBody, {
    id: customId,
  });

  const listResponse = await fetch(`${baseUrl}/api/items?search=${customId}`);

  const listBody = (await listResponse.json()) as {
    items: number[];
    nextCursor: string | null;
    hasMore: boolean;
  };

  assert.equal(listResponse.status, 200);
  assert.deepEqual(listBody.items, [customId]);
  assert.equal(listBody.nextCursor, null);
  assert.equal(listBody.hasMore, false);
});

test('POST /api/selected-items moves item from available to selected items', async (t) => {
  const selectedId = 42;

  const dataRequestQueue = new DataRequestQueue(1);
  const createItemQueue = new CreateItemQueue(60_000);

  const app = createApp({
    dataRequestQueue,
    createItemQueue,
  });

  const server = app.listen(0, '127.0.0.1');

  t.after(async () => {
    server.close();
    await dataRequestQueue.shutdown();
    await createItemQueue.shutdown();

    const selectedIdIndex = itemsState.selectedIds.indexOf(selectedId);

    if (selectedIdIndex !== -1) {
      itemsState.selectedIds.splice(selectedIdIndex, 1);
    }

    itemsState.selectedIdsSet.delete(selectedId);
  });

  await once(server, 'listening');

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const beforeResponse = await fetch(`${baseUrl}/api/items?search=${selectedId}`);

  const beforeBody = (await beforeResponse.json()) as {
    items: number[];
  };

  assert.equal(beforeResponse.status, 200);
  assert.equal(beforeBody.items.includes(selectedId), true);

  const selectResponse = await fetch(`${baseUrl}/api/selected-items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: selectedId,
    }),
  });

  const selectBody = (await selectResponse.json()) as {
    id: number;
  };

  assert.equal(selectResponse.status, 201);
  assert.deepEqual(selectBody, {
    id: selectedId,
  });

  const availableResponse = await fetch(`${baseUrl}/api/items?search=${selectedId}`);

  const availableBody = (await availableResponse.json()) as {
    items: number[];
  };

  assert.equal(availableResponse.status, 200);
  assert.equal(availableBody.items.includes(selectedId), false);

  const selectedResponse = await fetch(`${baseUrl}/api/selected-items?search=${selectedId}`);

  const selectedBody = (await selectedResponse.json()) as {
    items: number[];
    nextCursor: string | null;
    hasMore: boolean;
    totalCount: number;
  };

  assert.equal(selectedResponse.status, 200);
  assert.deepEqual(selectedBody.items, [selectedId]);
  assert.equal(selectedBody.nextCursor, null);
  assert.equal(selectedBody.hasMore, false);
  assert.equal(selectedBody.totalCount, 1);
});

test('DELETE /api/selected-items/:id returns item to available items', async (t) => {
  const selectedId = 43;

  const dataRequestQueue = new DataRequestQueue(1);
  const createItemQueue = new CreateItemQueue(60_000);

  const app = createApp({
    dataRequestQueue,
    createItemQueue,
  });

  const server = app.listen(0, '127.0.0.1');

  t.after(async () => {
    server.close();
    await dataRequestQueue.shutdown();
    await createItemQueue.shutdown();

    const selectedIdIndex = itemsState.selectedIds.indexOf(selectedId);

    if (selectedIdIndex !== -1) {
      itemsState.selectedIds.splice(selectedIdIndex, 1);
    }

    itemsState.selectedIdsSet.delete(selectedId);
  });

  await once(server, 'listening');

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const selectResponse = await fetch(`${baseUrl}/api/selected-items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: selectedId,
    }),
  });

  assert.equal(selectResponse.status, 201);

  const removeResponse = await fetch(`${baseUrl}/api/selected-items/${selectedId}`, {
    method: 'DELETE',
  });

  const removeBody = (await removeResponse.json()) as {
    id: number;
  };

  assert.equal(removeResponse.status, 200);
  assert.deepEqual(removeBody, {
    id: selectedId,
  });

  const selectedResponse = await fetch(`${baseUrl}/api/selected-items?search=${selectedId}`);

  const selectedBody = (await selectedResponse.json()) as {
    items: number[];
  };

  assert.equal(selectedResponse.status, 200);
  assert.equal(selectedBody.items.includes(selectedId), false);

  const availableResponse = await fetch(`${baseUrl}/api/items?search=${selectedId}`);

  const availableBody = (await availableResponse.json()) as {
    items: number[];
  };

  assert.equal(availableResponse.status, 200);
  assert.equal(availableBody.items.includes(selectedId), true);
});

test('PATCH /api/selected-items/order changes selected items order', async (t) => {
  const selectedIds = [44, 45, 46];

  const dataRequestQueue = new DataRequestQueue(1);
  const createItemQueue = new CreateItemQueue(60_000);

  const app = createApp({
    dataRequestQueue,
    createItemQueue,
  });

  const server = app.listen(0, '127.0.0.1');

  t.after(async () => {
    server.close();
    await dataRequestQueue.shutdown();
    await createItemQueue.shutdown();

    for (const id of selectedIds) {
      const index = itemsState.selectedIds.indexOf(id);

      if (index !== -1) {
        itemsState.selectedIds.splice(index, 1);
      }

      itemsState.selectedIdsSet.delete(id);
    }
  });

  await once(server, 'listening');

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  for (const id of selectedIds) {
    const response = await fetch(`${baseUrl}/api/selected-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id,
      }),
    });

    assert.equal(response.status, 201);
  }

  const beforeResponse = await fetch(`${baseUrl}/api/selected-items`);

  const beforeBody = (await beforeResponse.json()) as {
    items: number[];
  };

  assert.deepEqual(beforeBody.items, [44, 45, 46]);

  const reorderResponse = await fetch(`${baseUrl}/api/selected-items/order`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ids: [46, 44, 45],
    }),
  });

  const reorderBody = (await reorderResponse.json()) as {
    items: number[];
  };

  assert.equal(reorderResponse.status, 200);
  assert.deepEqual(reorderBody.items, [46, 44, 45]);

  const afterResponse = await fetch(`${baseUrl}/api/selected-items`);

  const afterBody = (await afterResponse.json()) as {
    items: number[];
  };

  assert.equal(afterResponse.status, 200);
  assert.deepEqual(afterBody.items, [46, 44, 45]);
});

test('GET /api/selected-items returns 400 for invalid limit', async (t) => {
  const dataRequestQueue = new DataRequestQueue(1);
  const createItemQueue = new CreateItemQueue(60_000);

  const app = createApp({
    dataRequestQueue,
    createItemQueue,
  });

  const server = app.listen(0, '127.0.0.1');

  t.after(async () => {
    server.close();
    await dataRequestQueue.shutdown();
    await createItemQueue.shutdown();
  });

  await once(server, 'listening');

  const address = server.address() as AddressInfo;

  const response = await fetch(`http://127.0.0.1:${address.port}/api/selected-items?limit=21`);

  const body = (await response.json()) as {
    error: string;
  };

  assert.equal(response.status, 400);
  assert.deepEqual(body, {
    error: 'Limit must be an integer between 1 and 20',
  });
});

test('PATCH /api/selected-items/order invalidates existing cursor', async (t) => {
  const selectedIds = [47, 48, 49];

  const dataRequestQueue = new DataRequestQueue(1);
  const createItemQueue = new CreateItemQueue(60_000);

  const app = createApp({
    dataRequestQueue,
    createItemQueue,
  });

  const server = app.listen(0, '127.0.0.1');

  t.after(async () => {
    server.close();
    await dataRequestQueue.shutdown();
    await createItemQueue.shutdown();

    for (const id of selectedIds) {
      const index = itemsState.selectedIds.indexOf(id);

      if (index !== -1) {
        itemsState.selectedIds.splice(index, 1);
      }

      itemsState.selectedIdsSet.delete(id);
    }
  });

  await once(server, 'listening');

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  for (const id of selectedIds) {
    const response = await fetch(`${baseUrl}/api/selected-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id }),
    });

    assert.equal(response.status, 201);
  }

  const pageResponse = await fetch(`${baseUrl}/api/selected-items?limit=2`);

  const pageBody = (await pageResponse.json()) as {
    items: number[];
    nextCursor: string | null;
  };

  assert.deepEqual(pageBody.items, [47, 48]);
  assert.notEqual(pageBody.nextCursor, null);

  const reorderResponse = await fetch(`${baseUrl}/api/selected-items/order`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ids: [49, 47, 48],
    }),
  });

  assert.equal(reorderResponse.status, 200);

  const staleCursorResponse = await fetch(
    `${baseUrl}/api/selected-items?limit=2&cursor=${encodeURIComponent(pageBody.nextCursor!)}`,
  );

  const staleCursorBody = (await staleCursorResponse.json()) as {
    error: string;
  };

  assert.equal(staleCursorResponse.status, 400);
  assert.deepEqual(staleCursorBody, {
    error: 'Cursor is stale',
  });
});

test('POST /api/items returns 409 when item already exists', async (t) => {
  const customId = 1_000_002;

  const dataRequestQueue = new DataRequestQueue(1);
  const createItemQueue = new CreateItemQueue(1);

  const app = createApp({
    dataRequestQueue,
    createItemQueue,
  });

  const server = app.listen(0, '127.0.0.1');

  t.after(async () => {
    server.close();
    await dataRequestQueue.shutdown();
    await createItemQueue.shutdown();

    const customIdIndex = itemsState.customIds.indexOf(customId);

    if (customIdIndex !== -1) {
      itemsState.customIds.splice(customIdIndex, 1);
    }

    itemsState.customIdsSet.delete(customId);
  });

  await once(server, 'listening');

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const firstResponse = await fetch(`${baseUrl}/api/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: customId,
    }),
  });

  assert.equal(firstResponse.status, 201);

  const duplicateResponse = await fetch(`${baseUrl}/api/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: customId,
    }),
  });

  const duplicateBody = (await duplicateResponse.json()) as {
    error: string;
  };

  assert.equal(duplicateResponse.status, 409);
  assert.deepEqual(duplicateBody, {
    error: `Item with ID ${customId} already exists`,
  });
});

test('POST /api/selected-items returns 409 when item is already selected', async (t) => {
  const selectedId = 50;

  const dataRequestQueue = new DataRequestQueue(1);
  const createItemQueue = new CreateItemQueue(60_000);

  const app = createApp({
    dataRequestQueue,
    createItemQueue,
  });

  const server = app.listen(0, '127.0.0.1');

  t.after(async () => {
    server.close();
    await dataRequestQueue.shutdown();
    await createItemQueue.shutdown();

    const selectedIdIndex = itemsState.selectedIds.indexOf(selectedId);

    if (selectedIdIndex !== -1) {
      itemsState.selectedIds.splice(selectedIdIndex, 1);
    }

    itemsState.selectedIdsSet.delete(selectedId);
  });

  await once(server, 'listening');

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const firstResponse = await fetch(`${baseUrl}/api/selected-items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: selectedId,
    }),
  });

  assert.equal(firstResponse.status, 201);

  const duplicateResponse = await fetch(`${baseUrl}/api/selected-items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: selectedId,
    }),
  });

  const duplicateBody = (await duplicateResponse.json()) as {
    error: string;
  };

  assert.equal(duplicateResponse.status, 409);
  assert.deepEqual(duplicateBody, {
    error: `Item with ID ${selectedId} is already selected`,
  });
});
