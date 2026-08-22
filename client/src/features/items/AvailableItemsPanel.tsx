import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectItem } from '../selected-items/selected-items.slice';
import { createItem, fetchItems, setSearch } from './items.slice';
import { useInfiniteScroll } from '../../shared/hooks/useInfiniteScroll';

import './available-items-panel.scss';

const SEARCH_DELAY_MS = 300;

const parseItemId = (value: string): number | null => {
  const normalizedValue = value.trim();

  if (!/^-?\d+$/.test(normalizedValue)) {
    return null;
  }

  const id = Number(normalizedValue);

  if (!Number.isSafeInteger(id)) {
    return null;
  }

  return id;
};

export function AvailableItemsPanel() {
  const dispatch = useAppDispatch();

  const { items, search, nextCursor, hasMore, listStatus, createStatus, listError, createError } =
    useAppSelector((state) => state.items);

  const { selectStatus, selectError } = useAppSelector((state) => state.selectedItems);

  const [newItemId, setNewItemId] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void dispatch(
        fetchItems({
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
      fetchItems({
        search,
        cursor: nextCursor,
        append: true,
      }),
    );
  }, [dispatch, hasMore, listStatus, nextCursor, search]);

  const handleCreateItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const id = parseItemId(newItemId);

    if (id === null) {
      setValidationError('Введите целое безопасное число');
      return;
    }

    setValidationError(null);

    const result = await dispatch(createItem(id));

    if (!createItem.fulfilled.match(result)) {
      return;
    }

    setNewItemId('');

    void dispatch(
      fetchItems({
        search,
      }),
    );
  };

  const handleSelectItem = async (id: number) => {
    const result = await dispatch(selectItem(id));

    if (!selectItem.fulfilled.match(result)) {
      return;
    }

    void dispatch(
      fetchItems({
        search,
      }),
    );
  };

  const isInitialLoading = listStatus === 'loading' && items.length === 0;

  const isLoadingMore = listStatus === 'loading' && items.length > 0;

  const { scrollContainerRef, loadMoreRef } = useInfiniteScroll({
    hasMore: hasMore && nextCursor !== null,
    isLoading: listStatus === 'loading',
    onLoadMore: handleLoadMore,
  });

  return (
    <section className="items-panel">
      <div className="items-panel__header">
        <div>
          <h2 className="items-panel__title">Доступные элементы</h2>

          <p className="items-panel__description">Загружено: {items.length}</p>
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
            dispatch(setSearch(event.target.value));
          }}
        />
      </label>

      <form className="items-panel__add-form" onSubmit={handleCreateItem}>
        <label className="items-panel__field">
          <span className="items-panel__label">Новый ID</span>

          <input
            className="items-panel__input"
            type="text"
            inputMode="numeric"
            value={newItemId}
            placeholder="Введите произвольный ID"
            onChange={(event) => {
              setNewItemId(event.target.value);
            }}
          />
        </label>

        <button className="items-panel__button" type="submit" disabled={createStatus === 'loading'}>
          {createStatus === 'loading' ? 'Добавление...' : 'Добавить'}
        </button>
      </form>

      {validationError ? <p className="items-panel__error">{validationError}</p> : null}

      {createError ? <p className="items-panel__error">{createError}</p> : null}

      {selectError ? <p className="items-panel__error">{selectError}</p> : null}

      {listError ? <p className="items-panel__error">{listError}</p> : null}

      {isInitialLoading ? <p className="items-panel__status">Загрузка...</p> : null}

      {!isInitialLoading && items.length === 0 && !listError ? (
        <p className="items-panel__status">Элементы не найдены</p>
      ) : null}

      <div className="items-panel__scroll" ref={scrollContainerRef}>
        <ul className="items-panel__list">
          {items.map((id) => (
            <li className="items-panel__item" key={id}>
              <span>ID {id}</span>

              <button
                className="items-panel__select"
                type="button"
                disabled={selectStatus === 'loading'}
                onClick={() => {
                  void handleSelectItem(id);
                }}
              >
                Выбрать
              </button>
            </li>
          ))}
        </ul>

        {isLoadingMore ? (
          <p className="items-panel__loading-more">Загрузка...</p>
        ) : null}

        {hasMore && nextCursor ? (
          <div
            className="items-panel__sentinel"
            ref={loadMoreRef}
            aria-hidden="true"
          />
        ) : null}
      </div>
    </section>
  );
}
