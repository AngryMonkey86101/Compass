import { useState, useRef } from 'react';
import AddLocationForm from './AddLocationForm';
import ImportPanel from './ImportPanel';
import useFileImport from '../hooks/useFileImport';

// iOS без MIME-типов может не дать выбрать .kmz/.kml в «Файлах»
const IMPORT_ACCEPT = '.kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml';

// Список точек с буквенными маркерами и дистанцией до каждой; «+» раскрывает форму новой точки,
// удаление выбранной — с подтверждением прямо в панели (window.confirm блокируется в PWA);
// «Импорт» загружает точки из файла KMZ/KML
export default function LocationList({ items, selectedId, onSelect, onAdd, onImport, onDelete }) {
  const [isAdding, setIsAdding] = useState(false);
  // id точки, удаление которой подтверждается: подтверждение не переходит на другую выбранную точку
  const [confirmId, setConfirmId] = useState(null);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const isConfirming = selected !== null && confirmId === selected.id;
  const fileImport = useFileImport();
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    // сброс, чтобы повторный выбор того же файла снова вызвал change
    e.target.value = '';
    if (!file) return;
    setIsAdding(false);
    fileImport.parse(file);
  };

  const handleImportConfirm = () => {
    onImport(fileImport.points);
    fileImport.clear();
  };

  const handleAdd = (name, lat, lon) => {
    onAdd(name, lat, lon);
    setIsAdding(false);
  };

  const handleSelect = (id) => {
    setConfirmId(null);
    onSelect(id);
  };

  const handleDelete = () => {
    if (isConfirming) onDelete(selected.id);
    setConfirmId(null);
  };

  return (
    <section className="panel" aria-labelledby="loc-list-title">
      <div className="panel__header">
        <h2 id="loc-list-title" className="label">Точки · {items.length}</h2>
        <div className="panel__actions">
          <input
            ref={fileInputRef}
            type="file"
            accept={IMPORT_ACCEPT}
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="btn btn--secondary"
            aria-label="Импорт точек из файла KMZ или KML"
            onClick={() => fileInputRef.current?.click()}
          >
            Импорт
          </button>
          <button
            type="button"
            className="btn btn--icon"
            aria-label={isAdding ? 'Закрыть форму новой точки' : 'Добавить точку'}
            aria-expanded={isAdding}
            onClick={() => setIsAdding((v) => !v)}
          >
            {isAdding ? '×' : '+'}
          </button>
        </div>
      </div>

      <ImportPanel {...fileImport} onConfirm={handleImportConfirm} onCancel={fileImport.clear} />

      {isAdding && <AddLocationForm onAdd={handleAdd} onCancel={() => setIsAdding(false)} />}

      {items.length === 0 ? (
        <p className="empty">Точек нет. Нажмите «+» или «Импорт», чтобы добавить.</p>
      ) : (
        <ul className="loc-list">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="loc-item"
                aria-pressed={item.id === selectedId}
                onClick={() => handleSelect(item.id)}
              >
                <span className="marker" aria-hidden="true">{item.label}</span>
                <span className="loc-item__name">{item.name}</span>
                <span className="loc-item__distance mono">{item.distance ?? '—'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="loc-list__footer">
          {isConfirming ? (
            <>
              <p className="error" role="alert">Удалить точку «{selected.name}»?</p>
              <div className="btn-row">
                <button type="button" className="btn btn--danger" onClick={handleDelete}>Удалить</button>
                <button type="button" className="btn btn--secondary" onClick={() => setConfirmId(null)}>Отмена</button>
              </div>
            </>
          ) : (
            <button type="button" className="btn btn--danger btn--block" onClick={() => setConfirmId(selected.id)}>
              Удалить {selected.label}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
