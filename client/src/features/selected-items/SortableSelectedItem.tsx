import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';

interface SortableSelectedItemProps {
  id: number;
  disabled: boolean;
  onRemove: (id: number) => void;
}

export function SortableSelectedItem({ id, disabled, onRemove }: SortableSelectedItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      className={`items-panel__item selected-items-panel__item${
        isDragging ? ' selected-items-panel__item--dragging' : ''
      }`}
      style={style}
    >
      <button
        className="selected-items-panel__drag-handle"
        type="button"
        disabled={disabled}
        aria-label={`Изменить положение элемента ${id}`}
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>

      <span className="selected-items-panel__id">ID {id}</span>

      <button
        className="selected-items-panel__remove"
        type="button"
        disabled={disabled}
        onClick={() => {
          onRemove(id);
        }}
      >
        Удалить
      </button>
    </li>
  );
}
