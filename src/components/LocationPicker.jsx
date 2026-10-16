import { useId } from 'react';

export default function LocationPicker({ locations, selectedId, onSelect, onDelete }) {
  const selectId = useId();

  return (
    <div className="card">
      <label htmlFor={selectId} className="card__title" style={{ display: 'block' }}>
        Выбор точки
      </label>
      <select
        id={selectId}
        className="field"
        value={selectedId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
      >
        {locations.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>

      <button
        type="button"
        className="btn btn--danger"
        onClick={onDelete}
        disabled={!selectedId}
      >
        Удалить выбранную точку
      </button>
    </div>
  );
}
