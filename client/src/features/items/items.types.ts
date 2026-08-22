export interface ItemsPage {
  items: number[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface GetItemsParams {
  search?: string;
  cursor?: string | null;
  limit?: number;
}

export interface CreatedItem {
  id: number;
}
