import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import {
  getSelectedItems,
  removeSelectedItem as removeSelectedItemRequest,
  reorderSelectedItems as reorderSelectedItemsRequest,
  selectItem as selectItemRequest,
} from './selected-items.api';
import type { SelectedItemsPage } from './selected-items.types';

const PAGE_LIMIT = 20;

type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface FetchSelectedItemsArgs {
  search: string;
  cursor?: string | null;
  append?: boolean;
}

interface SelectedItemsState {
  items: number[];
  search: string;
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;

  listStatus: RequestStatus;
  selectStatus: RequestStatus;
  removeStatus: RequestStatus;
  reorderStatus: RequestStatus;

  listError: string | null;
  selectError: string | null;
  removeError: string | null;
  reorderError: string | null;

  activeListRequestId: string | null;
}

const initialState: SelectedItemsState = {
  items: [],
  search: '',
  nextCursor: null,
  hasMore: true,
  totalCount: 0,

  listStatus: 'idle',
  selectStatus: 'idle',
  removeStatus: 'idle',
  reorderStatus: 'idle',

  listError: null,
  selectError: null,
  removeError: null,
  reorderError: null,

  activeListRequestId: null,
};

const getRequestError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown request error';
};

const matchesSearch = (id: number, search: string): boolean => {
  return search === '' || String(id).startsWith(search);
};

export const fetchSelectedItems = createAsyncThunk<
  SelectedItemsPage,
  FetchSelectedItemsArgs,
  { rejectValue: string }
>(
  'selectedItems/fetchSelectedItems',
  async ({ search, cursor }, { rejectWithValue, signal }) => {
    try {
      return await getSelectedItems(
        {
          search,
          cursor,
          limit: PAGE_LIMIT,
        },
        signal,
      );
    } catch (error) {
      return rejectWithValue(getRequestError(error));
    }
  },
);

export const selectItem = createAsyncThunk<number, number, { rejectValue: string }>(
  'selectedItems/selectItem',
  async (id, { rejectWithValue, signal }) => {
    try {
      const result = await selectItemRequest(id, signal);

      return result.id;
    } catch (error) {
      return rejectWithValue(getRequestError(error));
    }
  },
);

export const removeSelectedItem = createAsyncThunk<number, number, { rejectValue: string }>(
  'selectedItems/removeSelectedItem',
  async (id, { rejectWithValue, signal }) => {
    try {
      const result = await removeSelectedItemRequest(id, signal);

      return result.id;
    } catch (error) {
      return rejectWithValue(getRequestError(error));
    }
  },
);

export const reorderSelectedItems = createAsyncThunk<number[], number[], { rejectValue: string }>(
  'selectedItems/reorderSelectedItems',
  async (ids, { rejectWithValue, signal }) => {
    try {
      const result = await reorderSelectedItemsRequest(ids, signal);

      return result.items;
    } catch (error) {
      return rejectWithValue(getRequestError(error));
    }
  },
);

const selectedItemsSlice = createSlice({
  name: 'selectedItems',
  initialState,
  reducers: {
    setSelectedItemsSearch: (state, action: PayloadAction<string>) => {
      state.search = action.payload;
      state.nextCursor = null;
      state.hasMore = false;
    },

    applySelectedItemsOrder: (state, action: PayloadAction<number[]>) => {
      const reorderedIds = action.payload;
      const reorderedIdsSet = new Set(reorderedIds);

      let reorderedIndex = 0;

      state.items = state.items.map((id) => {
        if (!reorderedIdsSet.has(id)) {
          return id;
        }

        const reorderedId = reorderedIds[reorderedIndex];

        if (reorderedId === undefined) {
          return id;
        }

        reorderedIndex += 1;

        return reorderedId;
      });
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchSelectedItems.pending, (state, action) => {
        state.listStatus = 'loading';
        state.listError = null;
        state.activeListRequestId = action.meta.requestId;

        if (!action.meta.arg.append) {
          state.items = [];
          state.nextCursor = null;
          state.hasMore = true;
        }
      })

      .addCase(fetchSelectedItems.fulfilled, (state, action) => {
        if (state.activeListRequestId !== action.meta.requestId) {
          return;
        }

        if (action.meta.arg.append) {
          state.items.push(...action.payload.items);
        } else {
          state.items = action.payload.items;
        }

        state.nextCursor = action.payload.nextCursor;
        state.hasMore = action.payload.hasMore;
        state.totalCount = action.payload.totalCount;

        state.listStatus = 'succeeded';
        state.activeListRequestId = null;
      })

      .addCase(fetchSelectedItems.rejected, (state, action) => {
        if (state.activeListRequestId !== action.meta.requestId) {
          return;
        }

        state.listStatus = 'failed';
        state.listError = action.payload ?? 'Failed to load selected items';
        state.activeListRequestId = null;
      })

      .addCase(selectItem.pending, (state) => {
        state.selectStatus = 'loading';
        state.selectError = null;
      })

      .addCase(selectItem.fulfilled, (state, action) => {
        state.selectStatus = 'succeeded';
        state.totalCount += 1;

        if (!state.hasMore && matchesSearch(action.payload, state.search)) {
          state.items.push(action.payload);
        }
      })

      .addCase(selectItem.rejected, (state, action) => {
        state.selectStatus = 'failed';
        state.selectError = action.payload ?? 'Failed to select item';
      })

      .addCase(removeSelectedItem.pending, (state) => {
        state.removeStatus = 'loading';
        state.removeError = null;
      })

      .addCase(removeSelectedItem.fulfilled, (state, action) => {
        state.items = state.items.filter((id) => id !== action.payload);
        state.totalCount = Math.max(0, state.totalCount - 1);
        state.removeStatus = 'succeeded';
      })

      .addCase(removeSelectedItem.rejected, (state, action) => {
        state.removeStatus = 'failed';
        state.removeError = action.payload ?? 'Failed to remove selected item';
      })

      .addCase(reorderSelectedItems.pending, (state) => {
        state.reorderStatus = 'loading';
        state.reorderError = null;
      })

      .addCase(reorderSelectedItems.fulfilled, (state) => {
        state.reorderStatus = 'succeeded';
      })

      .addCase(reorderSelectedItems.rejected, (state, action) => {
        state.reorderStatus = 'failed';
        state.reorderError = action.payload ?? 'Failed to reorder selected items';
      });
  },
});

export const { applySelectedItemsOrder, setSelectedItemsSearch } = selectedItemsSlice.actions;

export default selectedItemsSlice.reducer;