import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { createItem as createItemRequest, getItems } from './items.api';
import type { ItemsPage } from './items.types';

const PAGE_LIMIT = 20;

type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface FetchItemsArgs {
  search: string;
  cursor?: string | null;
  append?: boolean;
}

interface ItemsState {
  items: number[];
  search: string;
  nextCursor: string | null;
  hasMore: boolean;

  listStatus: RequestStatus;
  createStatus: RequestStatus;

  listError: string | null;
  createError: string | null;

  activeListRequestId: string | null;
}

const initialState: ItemsState = {
  items: [],
  search: '',
  nextCursor: null,
  hasMore: true,

  listStatus: 'idle',
  createStatus: 'idle',

  listError: null,
  createError: null,

  activeListRequestId: null,
};

const getRequestError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown request error';
};

export const fetchItems = createAsyncThunk<ItemsPage, FetchItemsArgs, { rejectValue: string }>(
  'items/fetchItems',
  async ({ search, cursor }, { rejectWithValue, signal }) => {
    try {
      return await getItems(
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

export const createItem = createAsyncThunk<number, number, { rejectValue: string }>(
  'items/createItem',
  async (id, { rejectWithValue, signal }) => {
    try {
      const result = await createItemRequest(id, signal);

      return result.id;
    } catch (error) {
      return rejectWithValue(getRequestError(error));
    }
  },
);

const itemsSlice = createSlice({
  name: 'items',
  initialState,
  reducers: {
    setSearch: (state, action: PayloadAction<string>) => {
      state.search = action.payload;
      state.nextCursor = null;
      state.hasMore = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchItems.pending, (state, action) => {
        state.listStatus = 'loading';
        state.listError = null;
        state.activeListRequestId = action.meta.requestId;

        if (!action.meta.arg.append) {
          state.items = [];
          state.nextCursor = null;
          state.hasMore = true;
        }
      })
      .addCase(fetchItems.fulfilled, (state, action) => {
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
        state.listStatus = 'succeeded';
        state.activeListRequestId = null;
      })
      .addCase(fetchItems.rejected, (state, action) => {
        if (state.activeListRequestId !== action.meta.requestId) {
          return;
        }

        state.listStatus = 'failed';
        state.listError = action.payload ?? 'Failed to load items';
        state.activeListRequestId = null;
      })
      .addCase(createItem.pending, (state) => {
        state.createStatus = 'loading';
        state.createError = null;
      })
      .addCase(createItem.fulfilled, (state) => {
        state.createStatus = 'succeeded';
      })
      .addCase(createItem.rejected, (state, action) => {
        state.createStatus = 'failed';
        state.createError = action.payload ?? 'Failed to create item';
      });
  },
});

export const { setSearch } = itemsSlice.actions;

export default itemsSlice.reducer;
