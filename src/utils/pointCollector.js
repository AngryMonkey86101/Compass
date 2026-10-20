import { isValidCoordinates } from './geoUtils';

const UNNAMED = 'Без названия';
const MAX_LINES_SHOWN = 5;

// Общий сборщик точек для всех форматов импорта. Безымянные получают номер
// («Без названия 1», «Без названия 2»…), повторы имён внутри одного файла — суффикс
// « (2)», « (3)»…, чтобы при импорте они не заменяли друг друга. Пропуски считаются
// по причинам, для CSV — с номерами строк.
function createPointCollector() {
  const points = [];
  const seen = new Map();
  const skips = new Map();
  let unnamedCount = 0;
  let skipped = 0;

  const skip = (reason, line) => {
    skipped += 1;
    const entry = skips.get(reason) ?? { count: 0, lines: [] };
    entry.count += 1;
    if (line !== undefined) entry.lines.push(line);
    skips.set(reason, entry);
  };

  // Возвращает true, если точка принята
  const add = (rawName, lat, lon, line) => {
    if (!isValidCoordinates(lat, lon)) {
      skip('координаты вне диапазона', line);
      return false;
    }
    const trimmed = typeof rawName === 'string' ? rawName.trim() : '';
    let name = trimmed || `${UNNAMED} ${++unnamedCount}`;
    const times = (seen.get(name) ?? 0) + 1;
    seen.set(name, times);
    if (times > 1) name = `${name} (${times})`;
    points.push({ name, lat, lon });
    return true;
  };

  // «без координат — 2», «ошибка в координатах (строки 5, 9) — 2»
  const result = () => ({
    points,
    skipped,
    skipNotes: [...skips].map(([reason, { count, lines }]) => {
      const shown = lines.slice(0, MAX_LINES_SHOWN).join(', ');
      const where = lines.length === 0 ? '' :
        ` (${lines.length === 1 ? 'строка' : 'строки'} ${shown}${lines.length > MAX_LINES_SHOWN ? '…' : ''})`;
      return `${reason}${where} — ${count}`;
    })
  });

  return { add, skip, result };
}

export { createPointCollector };
