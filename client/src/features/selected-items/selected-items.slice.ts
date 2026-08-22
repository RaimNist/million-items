import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import {
  getSelectedItems,
  removeSelectedItem as removeSelectedItemRequest,
  reorderSelectedItems as reorderSelectedItemsRequest,
  selectItem as selectItemRequest,
} from './selected-items.api';
import type { SelectedItemsResponse } from './selected-items.types';

type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface SelectedItemsState {
  items: number[];
  search: string;

  listStatus: RequestStatus;
  selectStatus: RequestStatus;
  removeStatus: RequestStatus;
  reorderStatus: RequestStatus;

  listError: string | null;
  selectError: string | null;
  removeError: string | null;
  reorderError: string | null;
}

const initialState: SelectedItemsState = {
  items: [],
  search: '',

  listStatus: 'idle',
  selectStatus: 'idle',
  removeStatus: 'idle',
  reorderStatus: 'idle',

  listError: null,
  selectError: null,
  removeError: null,
  reorderError: null,
};

const getRequestError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown request error';
};

export const fetchSelectedItems = createAsyncThunk<
  SelectedItemsResponse,
  void,
  { rejectValue: string }
>('selectedItems/fetchSelectedItems', async (_, { rejectWithValue, signal }) => {
  try {
    return await getSelectedItems(signal);
  } catch (error) {
    return rejectWithValue(getRequestError(error));
  }
});

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
      .addCase(fetchSelectedItems.pending, (state) => {
        state.listStatus = 'loading';
        state.listError = null;
      })
      .addCase(fetchSelectedItems.fulfilled, (state, action) => {
        state.items = action.payload.items;
        state.listStatus = 'succeeded';
      })
      .addCase(fetchSelectedItems.rejected, (state, action) => {
        state.listStatus = 'failed';
        state.listError = action.payload ?? 'Failed to load selected items';
      })

      .addCase(selectItem.pending, (state) => {
        state.selectStatus = 'loading';
        state.selectError = null;
      })
      .addCase(selectItem.fulfilled, (state, action) => {
        state.items.push(action.payload);
        state.selectStatus = 'succeeded';
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
      .addCase(reorderSelectedItems.fulfilled, (state, action) => {
        state.items = action.payload;
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
