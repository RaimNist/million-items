import { configureStore } from '@reduxjs/toolkit';

import itemsReducer from '../features/items/items.slice';
import selectedItemsReducer from '../features/selected-items/selected-items.slice';

export const store = configureStore({
  reducer: {
    items: itemsReducer,
    selectedItems: selectedItemsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;
