import { itemExists } from './items.service.js';
import { itemsState } from '../state/items-state.js';

export type SelectedItemsServiceErrorCode =
  'ITEM_NOT_FOUND' | 'ITEM_ALREADY_SELECTED' | 'ITEM_NOT_SELECTED' | 'INVALID_SELECTED_ORDER';

export class SelectedItemsServiceError extends Error {
  constructor(
    public readonly code: SelectedItemsServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SelectedItemsServiceError';
  }
}

export const getSelectedItems = (): number[] => {
  return [...itemsState.selectedIds];
};

export const selectItem = (id: number): number => {
  if (!itemExists(id)) {
    throw new SelectedItemsServiceError('ITEM_NOT_FOUND', `Item with ID ${id} does not exist`);
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
    throw new SelectedItemsServiceError('ITEM_NOT_SELECTED', `Item with ID ${id} is not selected`);
  }

  const index = itemsState.selectedIds.indexOf(id);

  if (index !== -1) {
    itemsState.selectedIds.splice(index, 1);
  }

  itemsState.selectedIdsSet.delete(id);

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
