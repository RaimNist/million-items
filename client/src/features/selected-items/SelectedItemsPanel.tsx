import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useCallback, useEffect } from 'react';

import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { useInfiniteScroll } from '../../shared/hooks/useInfiniteScroll';
import { fetchItems } from '../items/items.slice';
import { SortableSelectedItem } from './SortableSelectedItem';
import {
  applySelectedItemsOrder,
  fetchSelectedItems,
  removeSelectedItem,
  reorderSelectedItems,
  setSelectedItemsSearch,
} from './selected-items.slice';

import './selected-items-panel.scss';

const SEARCH_DELAY_MS = 300;

export function SelectedItemsPanel() {
  const dispatch = useAppDispatch();

  const { search: availableItemsSearch } = useAppSelector((state) => state.items);

  const {
    items,
    search,
    nextCursor,
    hasMore,
    totalCount,
    listStatus,
    removeStatus,
    reorderStatus,
    listError,
    removeError,
    reorderError,
  } = useAppSelector((state) => state.selectedItems);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void dispatch(
        fetchSelectedItems({
          search,
        }),
      );
    }, SEARCH_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dispatch, search]);

  const handleLoadMore = useCallback(() => {
    if (!nextCursor || !hasMore || listStatus === 'loading') {
      return;
    }

    void dispatch(
      fetchSelectedItems({
        search,
        cursor: nextCursor,
        append: true,
      }),
    );
  }, [dispatch, hasMore, listStatus, nextCursor, search]);

  const handleRemoveItem = async (id: number) => {
    const result = await dispatch(removeSelectedItem(id));

    if (!removeSelectedItem.fulfilled.match(result)) {
      return;
    }

    void dispatch(
      fetchSelectedItems({
        search,
      }),
    );

    void dispatch(
      fetchItems({
        search: availableItemsSearch,
      }),
    );
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }

    const activeId = Number(active.id);
    const overId = Number(over.id);

    const oldIndex = items.indexOf(activeId);
    const newIndex = items.indexOf(overId);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const previousItems = [...items];
    const reorderedItems = arrayMove(items, oldIndex, newIndex);

    dispatch(applySelectedItemsOrder(reorderedItems));

    const result = await dispatch(reorderSelectedItems(reorderedItems));

    if (!reorderSelectedItems.fulfilled.match(result)) {
      dispatch(applySelectedItemsOrder(previousItems));
    }
  };

  const isInitialLoading = listStatus === 'loading' && items.length === 0;

  const isLoadingMore = listStatus === 'loading' && items.length > 0;

  const isChanging = removeStatus === 'loading' || reorderStatus === 'loading';

  const { scrollContainerRef, loadMoreRef } = useInfiniteScroll({
    hasMore: hasMore && nextCursor !== null,
    isLoading: listStatus === 'loading',
    onLoadMore: handleLoadMore,
  });

  return (
    <section className="items-panel selected-items-panel">
      <div className="items-panel__header">
        <div>
          <h2 className="items-panel__title">Выбранные элементы</h2>

          <p className="items-panel__description">Выбрано: {totalCount}</p>
        </div>
      </div>

      <label className="items-panel__field">
        <span className="items-panel__label">Фильтр по ID</span>

        <input
          className="items-panel__input"
          type="search"
          value={search}
          placeholder="Например, 123"
          onChange={(event) => {
            dispatch(setSelectedItemsSearch(event.target.value));
          }}
        />
      </label>

      {listError ? (
        <p className="items-panel__error" role="alert">
          {listError}
        </p>
      ) : null}

      {removeError ? (
        <p className="items-panel__error" role="alert">
          {removeError}
        </p>
      ) : null}

      {reorderError ? (
        <p className="items-panel__error" role="alert">
          {reorderError}
        </p>
      ) : null}

      {isInitialLoading ? (
        <p className="items-panel__status" role="status" aria-live="polite">
          Загрузка...
        </p>
      ) : null}

      {!isInitialLoading && items.length === 0 && !listError ? (
        <p className="items-panel__status">
          {totalCount === 0 && search === ''
            ? 'Выбранных элементов пока нет'
            : 'Элементы не найдены'}
        </p>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event: DragEndEvent) => {
          void handleDragEnd(event);
        }}
      >
        <div
          className="items-panel__scroll"
          ref={scrollContainerRef}
          aria-busy={listStatus === 'loading'}
        >
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            <ul className="items-panel__list">
              {items.map((id) => (
                <SortableSelectedItem
                  key={id}
                  id={id}
                  disabled={isChanging}
                  onRemove={(itemId) => {
                    void handleRemoveItem(itemId);
                  }}
                />
              ))}
            </ul>
          </SortableContext>

          {isLoadingMore ? (
            <p className="items-panel__loading-more" role="status" aria-live="polite">
              Загрузка...
            </p>
          ) : null}

          {hasMore && nextCursor ? (
            <div className="items-panel__sentinel" ref={loadMoreRef} aria-hidden="true" />
          ) : null}
        </div>
      </DndContext>
    </section>
  );
}
