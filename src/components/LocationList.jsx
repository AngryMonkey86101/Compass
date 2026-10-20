import { useState } from 'react';
import AddLocationForm from './AddLocationForm';
import ImportPanel from './ImportPanel';
import ExportPanel from './ExportPanel';
import useFileImport from '../hooks/useFileImport';


// Список точек с буквенными маркерами и дистанцией до каждой; «+» раскрывает форму новой точки,
// удаление выбранной — с подтверждением прямо в панели (window.confirm блокируется в PWA);
// «Импорт» загружает точки из файла KMZ/KML/GPX/GeoJSON/CSV, «Экспорт» сохраняет их в файл
export default function LocationList({ items, selectedId, onSelect, onAdd, onImport, onExport, onDelete }) {
  // открытая панель под заголовком: форма новой точки или выбор формата экспорта
  const [openPanel, setOpenPanel] = useState(null);
  const isAdding = openPanel === 'add';
  const isExporting = openPanel === 'export' && items.length > 0;
  // id точки, удаление которой подтверждается: подтверждение не переходит на другую выбранную точку
  const [confirmId, setConfirmId] = useState(null);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const isConfirming = selected !== null && confirmId === selected.id;
  const fileImport = useFileImport();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    // сброс, чтобы повторный выбор того же файла снова вызвал change
    e.target.value = '';
    if (!file) return;
    setOpenPanel(null);
    fileImport.parse(file);
  };

  const handleImportConfirm = () => {
    onImport(fileImport.points);
    fileImport.clear();
  };

  const handleAdd = (name, lat, lon) => {
    onAdd(name, lat, lon);
    setOpenPanel(null);
  };

  const togglePanel = (panel) => {
    fileImport.clear();
    setOpenPanel((current) => (current === panel ? null : panel));
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
      <div className="panel__header panel__header--wrap">
        <h2 id="loc-list-title" className="label">Точки · {items.length}</h2>
        <div className="panel__actions">
          {/* Нативный выбор файла: поле внутри <label>, без программного click() — его игнорируют
              некоторые встроенные браузеры Android. Фильтра accept нет намеренно: iOS не знает тип
              .kml и показывает такие файлы серыми, Android может отфильтровать их по MIME.
              Формат проверяется по содержимому, на чужой файл будет понятная ошибка. */}
          <label className="btn btn--secondary file-btn">
            <input
              type="file"
              className="visually-hidden"
              aria-label="Импорт точек из файла KML, KMZ, GPX, GeoJSON или CSV"
              onChange={handleFileChange}
            />
            Импорт
          </label>
          <button
            type="button"
            className="btn btn--secondary"
            aria-expanded={isExporting}
            disabled={items.length === 0}
            onClick={() => togglePanel('export')}
          >
            Экспорт
          </button>
          <button
            type="button"
            className="btn btn--icon"
            aria-label={isAdding ? 'Закрыть форму новой точки' : 'Добавить точку'}
            aria-expanded={isAdding}
            onClick={() => togglePanel('add')}
          >
            {isAdding ? '×' : '+'}
          </button>
        </div>
      </div>

      <ImportPanel {...fileImport} onConfirm={handleImportConfirm} onCancel={fileImport.clear} />

      {isExporting && <ExportPanel count={items.length} onExport={onExport} onClose={() => setOpenPanel(null)} />}

      {isAdding && <AddLocationForm onAdd={handleAdd} onCancel={() => setOpenPanel(null)} />}

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
