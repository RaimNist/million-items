import { itemsState } from '../state/items-state.js';

export const MIN_ID = 1;
export const MAX_ID = 1_000_000;

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 20;

const MAX_SEARCH_LENGTH = 17;
const MAX_BASE_ID_DIGITS = String(MAX_ID).length;

export type ItemsServiceErrorCode =
  'INVALID_ID' | 'ITEM_ALREADY_EXISTS' | 'INVALID_LIMIT' | 'INVALID_SEARCH' | 'INVALID_CURSOR';

export class ItemsServiceError extends Error {
  constructor(
    public readonly code: ItemsServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ItemsServiceError';
  }
}

export interface GetAvailableItemsParams {
  limit?: number;
  cursor?: string | null;
  search?: string;
}

export interface ItemsPage {
  items: number[];
  nextCursor: string | null;
  hasMore: boolean;
}

type CursorSource = 'base' | 'custom';

interface ItemsCursorPayload {
  source: CursorSource;
  position: number;
  search: string;
}

interface NumberRange {
  start: number;
  end: number;
}

interface CollectedItem {
  id: number;
  cursorAfter: string;
}

export const isBaseItemId = (id: number): boolean => {
  return Number.isSafeInteger(id) && id >= MIN_ID && id <= MAX_ID;
};

export const itemExists = (id: number): boolean => {
  if (!Number.isSafeInteger(id)) {
    return false;
  }

  return isBaseItemId(id) || itemsState.customIdsSet.has(id);
};

export const createCustomItem = (id: number): number => {
  if (!Number.isSafeInteger(id)) {
    throw new ItemsServiceError('INVALID_ID', 'Item ID must be a safe integer');
  }

  if (itemExists(id)) {
    throw new ItemsServiceError('ITEM_ALREADY_EXISTS', `Item with ID ${id} already exists`);
  }

  itemsState.customIds.push(id);
  itemsState.customIdsSet.add(id);

  return id;
};

const validateLimit = (limit: number): number => {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) {
    throw new ItemsServiceError(
      'INVALID_LIMIT',
      `Limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`,
    );
  }

  return limit;
};

const validateSearch = (search: string): string => {
  if (search.length > MAX_SEARCH_LENGTH) {
    throw new ItemsServiceError(
      'INVALID_SEARCH',
      `Search must not exceed ${MAX_SEARCH_LENGTH} characters`,
    );
  }

  if (search !== '' && search !== '-' && !/^-?\d+$/.test(search)) {
    throw new ItemsServiceError(
      'INVALID_SEARCH',
      'Search must contain only an optional minus sign and digits',
    );
  }

  return search;
};

const matchesSearch = (id: number, search: string): boolean => {
  return search === '' || String(id).startsWith(search);
};

const createBaseRanges = (search: string): NumberRange[] => {
  if (search === '') {
    return [
      {
        start: MIN_ID,
        end: MAX_ID,
      },
    ];
  }

  if (!/^[1-9]\d*$/.test(search)) {
    return [];
  }

  if (search.length > MAX_BASE_ID_DIGITS) {
    return [];
  }

  const prefix = Number(search);
  const ranges: NumberRange[] = [];

  for (let digits = search.length; digits <= MAX_BASE_ID_DIGITS; digits += 1) {
    const multiplier = 10 ** (digits - search.length);
    const start = prefix * multiplier;

    if (start > MAX_ID) {
      break;
    }

    const end = Math.min(start + multiplier - 1, MAX_ID);

    ranges.push({
      start,
      end,
    });
  }

  return ranges;
};

const findNextBaseId = (position: number, ranges: NumberRange[]): number | null => {
  for (const range of ranges) {
    if (range.end < position) {
      continue;
    }

    const candidate = Math.max(position, range.start);

    if (candidate <= range.end) {
      return candidate;
    }
  }

  return null;
};

const encodeCursor = (payload: ItemsCursorPayload): string => {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isCursorPayload = (value: unknown): value is ItemsCursorPayload => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.source === 'base' || value.source === 'custom') &&
    Number.isSafeInteger(value.position) &&
    typeof value.search === 'string'
  );
};

const decodeCursor = (cursor: string, search: string): ItemsCursorPayload => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new ItemsServiceError('INVALID_CURSOR', 'Cursor is invalid');
  }

  if (!isCursorPayload(parsed)) {
    throw new ItemsServiceError('INVALID_CURSOR', 'Cursor is invalid');
  }

  if (parsed.search !== search) {
    throw new ItemsServiceError('INVALID_CURSOR', 'Cursor does not match the current search');
  }

  if (parsed.source === 'base' && (parsed.position < MIN_ID || parsed.position > MAX_ID + 1)) {
    throw new ItemsServiceError('INVALID_CURSOR', 'Base cursor position is invalid');
  }

  if (
    parsed.source === 'custom' &&
    (parsed.position < 0 || parsed.position > itemsState.customIds.length)
  ) {
    throw new ItemsServiceError('INVALID_CURSOR', 'Custom cursor position is invalid');
  }

  return parsed;
};

const collectBaseItems = (
  collected: CollectedItem[],
  targetCount: number,
  startPosition: number,
  search: string,
): void => {
  const ranges = createBaseRanges(search);
  let position = startPosition;

  while (collected.length < targetCount) {
    const id = findNextBaseId(position, ranges);

    if (id === null) {
      return;
    }

    position = id + 1;

    if (itemsState.selectedIdsSet.has(id)) {
      continue;
    }

    collected.push({
      id,
      cursorAfter: encodeCursor({
        source: 'base',
        position,
        search,
      }),
    });
  }
};

const collectCustomItems = (
  collected: CollectedItem[],
  targetCount: number,
  startIndex: number,
  search: string,
): void => {
  for (
    let index = startIndex;
    index < itemsState.customIds.length && collected.length < targetCount;
    index += 1
  ) {
    const id = itemsState.customIds[index];

    if (id === undefined) {
      continue;
    }

    if (itemsState.selectedIdsSet.has(id)) {
      continue;
    }

    if (!matchesSearch(id, search)) {
      continue;
    }

    collected.push({
      id,
      cursorAfter: encodeCursor({
        source: 'custom',
        position: index + 1,
        search,
      }),
    });
  }
};

export const getAvailableItems = (params: GetAvailableItemsParams = {}): ItemsPage => {
  const limit = validateLimit(params.limit ?? DEFAULT_PAGE_LIMIT);

  const search = validateSearch(params.search ?? '');

  const cursor = params.cursor ? decodeCursor(params.cursor, search) : null;

  const targetCount = limit + 1;
  const collected: CollectedItem[] = [];

  if (cursor === null || cursor.source === 'base') {
    collectBaseItems(collected, targetCount, cursor?.position ?? MIN_ID, search);

    if (collected.length < targetCount) {
      collectCustomItems(collected, targetCount, 0, search);
    }
  } else {
    collectCustomItems(collected, targetCount, cursor.position, search);
  }

  const hasMore = collected.length > limit;
  const visibleItems = collected.slice(0, limit);

  let nextCursor: string | null = null;

  if (hasMore) {
    const lastVisibleItem = visibleItems[visibleItems.length - 1];

    if (lastVisibleItem !== undefined) {
      nextCursor = lastVisibleItem.cursorAfter;
    }
  }

  return {
    items: visibleItems.map(({ id }) => id),
    nextCursor,
    hasMore,
  };
};
