import { itemsState } from '../state/items-state.js';

export const MIN_ID = 1;
export const MAX_ID = 1_000_000;

export const isBaseItemId = (id: number): boolean => {
  return Number.isSafeInteger(id) && id >= MIN_ID && id <= MAX_ID;
};

export const itemExists = (id: number): boolean => {
  if (!Number.isSafeInteger(id)) {
    return false;
  }

  return isBaseItemId(id) || itemsState.customIdsSet.has(id);
};
