import type {
  GetSelectedItemsParams,
  SelectedItemResponse,
  SelectedItemsPage,
  SelectedItemsResponse,
} from './selected-items.types';

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

export const getSelectedItems = async (
  params: GetSelectedItemsParams,
  signal?: AbortSignal,
): Promise<SelectedItemsPage> => {
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

  const response = await fetch(`/api/selected-items?${searchParams.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as SelectedItemsPage;
};

export const selectItem = async (
  id: number,
  signal?: AbortSignal,
): Promise<SelectedItemResponse> => {
  const response = await fetch('/api/selected-items', {
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

  return (await response.json()) as SelectedItemResponse;
};

export const removeSelectedItem = async (
  id: number,
  signal?: AbortSignal,
): Promise<SelectedItemResponse> => {
  const response = await fetch(`/api/selected-items/${id}`, {
    method: 'DELETE',
    signal,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as SelectedItemResponse;
};

export const reorderSelectedItems = async (
  ids: number[],
  signal?: AbortSignal,
): Promise<SelectedItemsResponse> => {
  const response = await fetch('/api/selected-items/order', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
    signal,
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as SelectedItemsResponse;
};