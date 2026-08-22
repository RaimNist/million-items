import type { CreatedItem, GetItemsParams, ItemsPage } from './items.types';

interface ErrorResponse {
  error?: string;
}

const getErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as ErrorResponse;

    if (typeof body.error === 'string') {
      return body.error;
    }
  } catch {
    // Response body may not contain JSON.
  }

  return `Request failed with status ${response.status}`;
};

export const getItems = async (
  params: GetItemsParams,
  signal?: AbortSignal,
): Promise<ItemsPage> => {
  const searchParams = new URLSearchParams();

  if (params.limit !== undefined) {
    searchParams.set('limit', String(params.limit));
  }

  if (params.search) {
    searchParams.set('search', params.search);
  }

  if (params.cursor) {
    searchParams.set('cursor', params.cursor);
  }

  const response = await fetch(`/api/items?${searchParams.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as ItemsPage;
};

export const createItem = async (id: number, signal?: AbortSignal): Promise<CreatedItem> => {
  const response = await fetch('/api/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
    signal,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as CreatedItem;
};
