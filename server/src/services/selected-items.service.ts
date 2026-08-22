import { itemExists } from './items.service.js';
import { itemsState } from '../state/items-state.js';

const DEFAULT_SELECTED_ITEMS_LIMIT = 20;
const MAX_SELECTED_ITEMS_LIMIT = 20;
const MAX_SEARCH_LENGTH = 17;

export type SelectedItemsServiceErrorCode =
  | 'ITEM_NOT_FOUND'
  | 'ITEM_ALREADY_SELECTED'
  | 'ITEM_NOT_SELECTED'
  | 'INVALID_SELECTED_ORDER'
  | 'INVALID_LIMIT'
  | 'INVALID_SEARCH'
  | 'INVALID_CURSOR';

export class SelectedItemsServiceError extends Error {
  constructor(
    public readonly code: SelectedItemsServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SelectedItemsServiceError';
  }
}

export interface GetSelectedItemsParams {
  limit?: number;
  cursor?: string | null;
  search?: string;
}

export interface SelectedItemsPage {
  items: number[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

interface SelectedItemsCursorPayload {
  position: number;
  search: string;
  version: number;
}

const validateLimit = (limit: number): number => {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_SELECTED_ITEMS_LIMIT) {
    throw new SelectedItemsServiceError(
      'INVALID_LIMIT',
      `Limit must be an integer between 1 and ${MAX_SELECTED_ITEMS_LIMIT}`,
    );
  }

  return limit;
};

const validateSearch = (search: string): string => {
  if (search.length > MAX_SEARCH_LENGTH) {
    throw new SelectedItemsServiceError(
      'INVALID_SEARCH',
      `Search must not exceed ${MAX_SEARCH_LENGTH} characters`,
    );
  }

  if (search !== '' && search !== '-' && !/^-?\d+$/.test(search)) {
    throw new SelectedItemsServiceError(
      'INVALID_SEARCH',
      'Search must contain only an optional minus sign and digits',
    );
  }

  return search;
};

const matchesSearch = (id: number, search: string): boolean => {
  return search === '' || String(id).startsWith(search);
};

const encodeCursor = (payload: SelectedItemsCursorPayload): string => {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isCursorPayload = (
  value: unknown,
): value is SelectedItemsCursorPayload => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.position === 'number' &&
    Number.isSafeInteger(value.position) &&
    typeof value.search === 'string' &&
    typeof value.version === 'number' &&
    Number.isSafeInteger(value.version)
  );
};

const decodeCursor = (
  cursor: string,
  search: string,
): SelectedItemsCursorPayload => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new SelectedItemsServiceError('INVALID_CURSOR', 'Cursor is invalid');
  }

  if (!isCursorPayload(parsed)) {
    throw new SelectedItemsServiceError('INVALID_CURSOR', 'Cursor is invalid');
  }

  if (parsed.search !== search) {
    throw new SelectedItemsServiceError(
      'INVALID_CURSOR',
      'Cursor does not match the current search',
    );
  }

  if (parsed.version !== itemsState.selectedIdsVersion) {
    throw new SelectedItemsServiceError(
      'INVALID_CURSOR',
      'Cursor is stale',
    );
  }

  if (parsed.position < 0 || parsed.position > itemsState.selectedIds.length) {
    throw new SelectedItemsServiceError(
      'INVALID_CURSOR',
      'Cursor position is invalid',
    );
  }

  return parsed;
};

export const getSelectedItems = (
  params: GetSelectedItemsParams = {},
): SelectedItemsPage => {
  const limit = validateLimit(params.limit ?? DEFAULT_SELECTED_ITEMS_LIMIT);
  const search = validateSearch(params.search ?? '');

  const cursor = params.cursor ? decodeCursor(params.cursor, search) : null;
  const startPosition = cursor?.position ?? 0;

  const collected: Array<{
    id: number;
    position: number;
  }> = [];

  for (
    let index = startPosition;
    index < itemsState.selectedIds.length && collected.length < limit + 1;
    index += 1
  ) {
    const id = itemsState.selectedIds[index];

    if (id === undefined || !matchesSearch(id, search)) {
      continue;
    }

    collected.push({
      id,
      position: index + 1,
    });
  }

  const hasMore = collected.length > limit;
  const visibleItems = collected.slice(0, limit);

  let nextCursor: string | null = null;

  if (hasMore) {
    const lastVisibleItem = visibleItems[visibleItems.length - 1];

    if (lastVisibleItem !== undefined) {
      nextCursor = encodeCursor({
        position: lastVisibleItem.position,
        search,
        version: itemsState.selectedIdsVersion,
      });
    }
  }

  return {
    items: visibleItems.map(({ id }) => id),
    nextCursor,
    hasMore,
    totalCount: itemsState.selectedIds.length,
  };
};

export const selectItem = (id: number): number => {
  if (!itemExists(id)) {
    throw new SelectedItemsServiceError(
      'ITEM_NOT_FOUND',
      `Item with ID ${id} does not exist`,
    );
  }

  if (itemsState.selectedIdsSet.has(id)) {
    throw new SelectedItemsServiceError(
      'ITEM_ALREADY_SELECTED',
      `Item with ID ${id} is already selected`,
    );
  }

  itemsState.selectedIds.push(id);
  itemsState.selectedIdsSet.add(id);

  return id;
};

export const removeSelectedItem = (id: number): number => {
  if (!itemsState.selectedIdsSet.has(id)) {
    throw new SelectedItemsServiceError(
      'ITEM_NOT_SELECTED',
      `Item with ID ${id} is not selected`,
    );
  }

  const index = itemsState.selectedIds.indexOf(id);

  if (index !== -1) {
    itemsState.selectedIds.splice(index, 1);
  }

  itemsState.selectedIdsSet.delete(id);
  itemsState.selectedIdsVersion += 1;

  return id;
};

export const reorderSelectedItems = (ids: number[]): number[] => {
  const uniqueIds = new Set(ids);

  if (uniqueIds.size !== ids.length) {
    throw new SelectedItemsServiceError(
      'INVALID_SELECTED_ORDER',
      'Selected item IDs must be unique',
    );
  }

  for (const id of ids) {
    if (!Number.isSafeInteger(id)) {
      throw new SelectedItemsServiceError(
        'INVALID_SELECTED_ORDER',
        'Selected item IDs must be safe integers',
      );
    }

    if (!itemsState.selectedIdsSet.has(id)) {
      throw new SelectedItemsServiceError(
        'INVALID_SELECTED_ORDER',
        `Item with ID ${id} is not selected`,
      );
    }
  }

  let reorderedIndex = 0;

  itemsState.selectedIds = itemsState.selectedIds.map((id) => {
    if (!uniqueIds.has(id)) {
      return id;
    }

    const reorderedId = ids[reorderedIndex];

    if (reorderedId === undefined) {
      throw new SelectedItemsServiceError(
        'INVALID_SELECTED_ORDER',
        'Selected items order is invalid',
      );
    }

    reorderedIndex += 1;

    return reorderedId;
  });

  return [...itemsState.selectedIds];
};