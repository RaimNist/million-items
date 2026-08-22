export interface ItemsState {
  customIds: number[];
  customIdsSet: Set<number>;

  selectedIds: number[];
  selectedIdsSet: Set<number>;
  selectedIdsVersion: number;
}

export const itemsState: ItemsState = {
  customIds: [],
  customIdsSet: new Set<number>(),

  selectedIds: [],
  selectedIdsSet: new Set<number>(),
  selectedIdsVersion: 0,
};
