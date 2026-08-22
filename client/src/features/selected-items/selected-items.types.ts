export interface GetSelectedItemsParams {
  search?: string;
  cursor?: string | null;
  limit?: number;
}

export interface SelectedItemsPage {
  items: number[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

export interface SelectedItemsResponse {
  items: number[];
}

export interface SelectedItemResponse {
  id: number;
}