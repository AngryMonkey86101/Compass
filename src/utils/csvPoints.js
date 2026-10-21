import { createPointCollector } from './pointCollector';
import { parseLocationText, parseMapUrl } from './locationText';
import { firstLine, unprotectFormula } from './text';

// Импорт точек из CSV: таблицы Excel / Google Таблиц, экспорт Конструктора карт Яндекса
// («Широта;Долгота;Описание;Подпись;Номер метки»), списки Google Takeout («Title,Note,URL,…»)
// и простые строки «Название;56.838;60.6035», набранные вручную.

// Разбивка на записи с учётом кавычек: поле в кавычках может содержать разделитель,
// перевод строки и удвоенную кавычку. Для каждой записи запоминается номер её первой строки.
function parseDelimited(text, delimiter) {
  const records = [];
  let fields = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let recordLine = 1;

  const endField = () => {
    fields.push(field);
    field = '';
  };
  const endRecord = () => {
    endField();
    if (fields.some((f) => f.trim() !== '')) records.push({ fields, line: recordLine });
    fields = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        if (ch === '\n') line += 1;
        field += ch;
      }
    } else if (ch === '"' && field.trim() === '') {
      field = '';
      quoted = true;
    } else if (ch === delimiter) {
      endField();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      endRecord();
      line += 1;
      recordLine = line;
    } else {
      field += ch;
    }
  }
  endRecord();
  return records;
}

// Разделитель по первой непустой строке: табуляция, затем «;» (не встречается в числах), иначе «,»
// (ищется без разбиения всего файла на строки)
function detectDelimiter(text) {
  let start = 0;
  let line = '';
  while (start < text.length) {
    const end = text.indexOf('\n', start);
    line = text.slice(start, end === -1 ? text.length : end);
    if (line.trim() !== '') break;
    if (end === -1) break;
    start = end + 1;
  }
  if (line.includes('\t')) return '\t';
  if (line.includes(';')) return ';';
  return ',';
}

const HEADER_KEYS = {
  name: ['название', 'наименование', 'имя', 'подпись', 'name', 'title', 'label', 'caption'],
  lat: ['широта', 'lat', 'latitude'],
  lon: ['долгота', 'lon', 'lng', 'long', 'longitude'],
  coords: ['координаты', 'coordinates', 'coords'],
  url: ['url', 'ссылка', 'link', 'google maps url'],
  description: ['описание', 'description', 'note', 'заметка', 'комментарий', 'comment']
};

const normalizeHeader = (cell) => cell.trim().toLowerCase().replace(/\s+/g, ' ');

// Номера столбцов по заголовку или null, если первая строка — не заголовок.
// Строка, где из ролей нашлось только название, — заголовок, лишь если в ней нет координат:
// иначе это точка, которую назвали «Name» или «Подпись», и её нельзя потерять.
function detectColumns(fields) {
  const columns = {};
  fields.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    for (const [role, names] of Object.entries(HEADER_KEYS)) {
      if (columns[role] === undefined && names.includes(key)) columns[role] = index;
    }
  });
  const hasLocation = columns.lat !== undefined || columns.lon !== undefined || columns.coords !== undefined ||
    columns.url !== undefined;
  if (hasLocation) return columns;
  if (columns.name !== undefined && !pointFromBareRow(fields)) return columns;
  return null;
}

const parseNumber = (cell) => {
  const text = String(cell ?? '').trim().replace(',', '.');
  return /^[-+]?\d+(?:\.\d+)?$/.test(text) ? parseFloat(text) : null;
};

const hasFraction = (cell) => /[.,]\d/.test(String(cell));

// Строка без заголовка: два числа подряд — широта и долгота, первый текст — название.
// Номер или код в соседнем столбце («1;56.838;60.6035») тоже число, поэтому из пар соседних
// чисел предпочитается та, где оба числа дробные, — так пишут координаты.
// Если чисел нет, пробуем каждую ячейку как координаты или ссылку.
function pointFromBareRow(fields) {
  let pair = null;
  for (let i = 0; i + 1 < fields.length; i += 1) {
    const lat = parseNumber(fields[i]);
    const lon = parseNumber(fields[i + 1]);
    if (lat === null || lon === null) continue;
    if (hasFraction(fields[i]) && hasFraction(fields[i + 1])) {
      pair = { i, lat, lon };
      break;
    }
    if (!pair) pair = { i, lat, lon };
  }
  if (pair) {
    const { i, lat, lon } = pair;
    const name = fields.find((cell, j) => j !== i && j !== i + 1 && cell.trim() && parseNumber(cell) === null);
    return { lat, lon, name: name ? unprotectFormula(name.trim()) : '' };
  }
  for (const cell of fields) {
    const found = parseLocationText(cell);
    if (found.lat !== undefined) {
      const name = fields.find((other) => other !== cell && other.trim() && parseNumber(other) === null);
      return { lat: found.lat, lon: found.lon, name: name ?? found.name ?? '' };
    }
  }
  return null;
}

function pointFromColumns(fields, columns) {
  const cell = (role) => (columns[role] === undefined ? '' : fields[columns[role]] ?? '');
  const name = unprotectFormula(cell('name').trim()) || firstLine(cell('description'));

  if (columns.lat !== undefined && columns.lon !== undefined) {
    const lat = parseNumber(cell('lat'));
    const lon = parseNumber(cell('lon'));
    return lat !== null && lon !== null ? { lat, lon, name } : { error: 'ошибка в координатах' };
  }
  if (columns.coords !== undefined) {
    const found = parseLocationText(cell('coords'));
    return found.lat !== undefined ? { lat: found.lat, lon: found.lon, name } : { error: 'ошибка в координатах' };
  }
  if (columns.url !== undefined) {
    // ссылка с запятой без кавычек («…/search/56.8,60.6») разрезается на два поля — склеиваем обратно
    const url = cell('url').trim();
    const next = fields[columns.url + 1] ?? '';
    const found = (url ? parseMapUrl(url) : null) ??
      (url && parseNumber(next) !== null ? parseMapUrl(`${url},${next.trim()}`) : null);
    return found?.lat !== undefined
      ? { lat: found.lat, lon: found.lon, name: name || found.name || '' }
      : { error: 'ссылка без координат' };
  }
  const bare = pointFromBareRow(fields);
  return bare ? { ...bare, name: name || bare.name } : { error: 'нет координат' };
}

// { points, skipped, skipNotes, recognized, hint } — recognized=false, если в тексте не нашлось
// ни заголовка, ни одной строки с координатами (значит, это не CSV)
function pointsFromCsv(text) {
  const records = parseDelimited(text, detectDelimiter(text));
  const collector = createPointCollector();
  if (records.length === 0) return { ...collector.result(), recognized: false };

  const columns = detectColumns(records[0].fields);
  const rows = columns ? records.slice(1) : records;

  for (const { fields, line } of rows) {
    const found = columns ? pointFromColumns(fields, columns) : pointFromBareRow(fields);
    if (!found) collector.skip('нет координат', line);
    else if (found.error) collector.skip(found.error, line);
    else collector.add(found.name, found.lat, found.lon, line);
  }

  const result = collector.result();
  // Списки Google Takeout («Хочу посетить.csv» и т. п.) содержат только ссылки на места без координат
  const urlOnly = columns && columns.url !== undefined && columns.lat === undefined && columns.coords === undefined;
  return {
    ...result,
    recognized: columns !== null || result.points.length > 0,
    hint: urlOnly && result.points.length === 0
      ? 'В списке Google нет координат мест, только ссылки. Перенесите места в Google My Maps и экспортируйте карту в KML'
      : null
  };
}

export { parseDelimited, detectDelimiter, pointsFromCsv };
