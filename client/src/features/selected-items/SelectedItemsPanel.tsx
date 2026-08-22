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
import { useEffect } from 'react';

import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { fetchItems } from '../items/items.slice';
import {
  applySelectedItemsOrder,
  fetchSelectedItems,
  removeSelectedItem,
  reorderSelectedItems,
  setSelectedItemsSearch,
} from './selected-items.slice';
import { SortableSelectedItem } from './SortableSelectedItem';

import './selected-items-panel.scss';

export function SelectedItemsPanel() {
  const dispatch = useAppDispatch();

  const { search: availableItemsSearch } = useAppSelector((state) => state.items);

  const {
    items,
    search,
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
    if (listStatus === 'idle') {
      void dispatch(fetchSelectedItems());
    }
  }, [dispatch, listStatus]);

  const filteredItems = items.filter((id) => String(id).startsWith(search));

  const handleRemoveItem = async (id: number) => {
    const result = await dispatch(removeSelectedItem(id));

    if (!removeSelectedItem.fulfilled.match(result)) {
      return;
    }

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

    const oldIndex = filteredItems.indexOf(activeId);
    const newIndex = filteredItems.indexOf(overId);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const previousItems = [...items];

    const reorderedVisibleItems = arrayMove(filteredItems, oldIndex, newIndex);

    dispatch(applySelectedItemsOrder(reorderedVisibleItems));

    const result = await dispatch(reorderSelectedItems(reorderedVisibleItems));

    if (!reorderSelectedItems.fulfilled.match(result)) {
      dispatch(applySelectedItemsOrder(previousItems));
    }
  };

  const isInitialLoading = listStatus === 'loading' && items.length === 0;

  const isChanging = removeStatus === 'loading' || reorderStatus === 'loading';

  return (
    <section className="items-panel selected-items-panel">
      <div className="items-panel__header">
        <div>
          <h2 className="items-panel__title">Выбранные элементы</h2>

          <p className="items-panel__description">Выбрано: {items.length}</p>
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

      {listError ? <p className="items-panel__error">{listError}</p> : null}

      {removeError ? <p className="items-panel__error">{removeError}</p> : null}

      {reorderError ? <p className="items-panel__error">{reorderError}</p> : null}

      {isInitialLoading ? <p className="items-panel__status">Загрузка...</p> : null}

      {!isInitialLoading && filteredItems.length === 0 && !listError ? (
        <p className="items-panel__status">
          {items.length === 0 ? 'Выбранных элементов пока нет' : 'Элементы не найдены'}
        </p>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event: DragEndEvent) => {
          void handleDragEnd(event);
        }}
      >
        <SortableContext items={filteredItems} strategy={verticalListSortingStrategy}>
          <ul className="items-panel__list">
            {filteredItems.map((id) => (
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
      </DndContext>
    </section>
  );
}
