import { kml, gpx } from '@tmcw/togeojson';
import { createPointCollector } from './pointCollector';
import { pointsFromCsv } from './csvPoints';
import { parseMapUrl } from './locationText';

// Импорт точек из KMZ, KML, GPX, GeoJSON и CSV. Разбор отделён от интерфейса, чтобы его можно было тестировать.
// togeojson (~3 КБ gzip) — в основном бандле: KML и GPX разбираются без дополнительных загрузок,
// даже если сеть обрывает запросы. JSZip (~28 КБ gzip) нужен только для KMZ и подгружается
// по требованию с ограничением по времени.

const JSZIP_TIMEOUT_MS = 15000;
const UNRECOGNIZED = 'Формат файла не распознан. Поддерживаются KML, KMZ, GPX, GeoJSON и CSV';

// Первая пара «долгота, широта» из любой геометрии GeoJSON: точка, линия, полигон,
// мульти-варианты и коллекции. Координаты могут содержать высоту ([lon, lat, alt]) —
// Google Earth пишет её всегда, поэтому берём первые два числа при любой длине.
function firstCoordinate(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'GeometryCollection') {
    for (const inner of geometry.geometries ?? []) {
      const found = firstCoordinate(inner);
      if (found) return found;
    }
    return null;
  }

  const walk = (value) => {
    if (!Array.isArray(value) || value.length === 0) return null;
    if (typeof value[0] === 'number') {
      return value.length >= 2 && typeof value[1] === 'number' ? { lon: value[0], lat: value[1] } : null;
    }
    for (const item of value) {
      const found = walk(item);
      if (found) return found;
    }
    return null;
  };
  return walk(geometry.coordinates);
}

const text = (value) => (typeof value === 'string' ? value.trim() : '');

// Название из свойств разных источников: KML/GPX/наш экспорт (name), Конструктор Яндекса
// (iconCaption, description), Google Takeout (location.name, Title, Location → Business Name),
// GPX без name (desc, cmt)
function featureName(props = {}) {
  const firstLine = (value) => text(value).split(/\r?\n/)[0].trim().slice(0, 80);
  return text(props.name) || text(props.iconCaption) || text(props.title) || text(props.Title) ||
    text(props.location?.name) || text(props.Location?.['Business Name']) ||
    firstLine(props.description) || firstLine(props.desc) || firstLine(props.cmt);
}

// Запасные координаты Google Takeout: Location → Geo Coordinates (старый формат) или ссылка на место
function takeoutCoordinate(props = {}) {
  const geo = props.Location?.['Geo Coordinates'];
  if (geo) {
    const lat = parseFloat(geo.Latitude);
    const lon = parseFloat(geo.Longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0)) return { lat, lon };
  }
  const url = props.google_maps_url ?? props['Google Maps URL'];
  const found = typeof url === 'string' ? parseMapUrl(url) : null;
  return found?.lat !== undefined ? { lat: found.lat, lon: found.lon } : null;
}

// Точки из GeoJSON: { points: [{ name, lat, lon }], skipped, skipNotes }.
// Google Takeout пишет 0,0, если не знает координат места: такие объекты пропускаются отдельно,
// если координаты не нашлись в других полях.
function pointsFromGeoJSON(geojson) {
  const collector = createPointCollector();
  const features = Array.isArray(geojson) ? geojson
    : geojson?.type === 'Feature' ? [geojson]
      : geojson?.features ?? [];

  for (const feature of features) {
    const props = feature?.properties ?? {};
    let coord = firstCoordinate(feature?.geometry);
    const unknown = coord && coord.lat === 0 && coord.lon === 0;
    if (!coord || unknown) coord = takeoutCoordinate(props);
    if (!coord) {
      collector.skip(unknown ? 'координаты неизвестны (так Google сохраняет часть мест)' : 'без координат');
      continue;
    }
    collector.add(featureName(props), coord.lat, coord.lon);
  }

  return collector.result();
}

const isZip = (bytes) => bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

// Имена файлов в zip хранятся открытым текстом, поэтому таблицу Excel видно без распаковки
const containsAscii = (bytes, needle) => {
  const limit = Math.min(bytes.length, 65536);
  outer: for (let i = 0; i + needle.length <= limit; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (bytes[i + j] !== needle.charCodeAt(j)) continue outer;
    }
    return true;
  }
  return false;
};

// Загрузка JSZip с ограничением по времени: при обрыве сети import() может висеть бесконечно
function loadJSZip(timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(
      'Модуль для KMZ не загрузился — проверьте сеть и выберите файл снова или используйте .kml'
    )), timeoutMs);
  });
  const load = import('jszip').then(
    (module) => module.default,
    () => {
      throw new Error('Модуль для KMZ не загрузился — проверьте сеть и выберите файл снова или используйте .kml');
    }
  );
  return Promise.race([load, timeout]).finally(() => clearTimeout(timer));
}

// Файл с точками из архива: KMZ (главный — doc.kml в корне, иначе первый .kml) или обычный zip,
// например архив Google Takeout (берём «Saved Places.json»), с GPX, GeoJSON или CSV внутри.
// Возвращает { text, isKml }.
async function textFromZip(buffer, jszipTimeoutMs) {
  const JSZip = await loadJSZip(jszipTimeoutMs);
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('Архив повреждён и не читается');
  }
  const entries = Object.values(zip.files).filter((entry) => !entry.dir && !/(^|\/)__MACOSX\//.test(entry.name));
  const find = (pattern) => entries.find((entry) => pattern.test(entry.name));

  const kmlFiles = entries.filter((entry) => /\.kml$/i.test(entry.name));
  const mainKml = kmlFiles.find((entry) => /(^|\/)doc\.kml$/i.test(entry.name)) ?? kmlFiles[0];
  if (mainKml) return { text: await mainKml.async('text'), isKml: true };

  const other = find(/(^|\/)saved places\.json$/i) ?? find(/\.geojson$/i) ?? find(/\.gpx$/i) ??
    find(/\.csv$/i) ?? find(/\.json$/i);
  if (!other) throw new Error('В архиве нет файла с точками (KML, GPX, GeoJSON или CSV)');
  return { text: decodeText(await other.async('uint8array')), isKml: false };
}

// UTF-8, а если байты в нём недопустимы — Windows-1251 (так сохраняет CSV русский Excel)
function decodeText(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1251').decode(bytes);
  }
}

function parseXml(source) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(source, 'application/xml');
  } catch {
    return null;
  }
  if (!doc?.documentElement || doc.getElementsByTagName('parsererror').length > 0) return null;
  return doc;
}

// KML или GPX по корневому элементу
function pointsFromXml(source, fromKmz) {
  const doc = parseXml(source);
  if (!doc) throw new Error(fromKmz ? 'KML внутри архива повреждён' : 'Файл XML повреждён и не читается');
  const root = doc.documentElement.localName.toLowerCase();

  if (root === 'kml') {
    const result = pointsFromGeoJSON(kml(doc));
    // My Maps с флажком «сетевая ссылка KML» отдаёт файл без точек, только адрес карты
    const networkLink = result.points.length === 0 && doc.getElementsByTagName('NetworkLink').length > 0;
    return {
      ...result,
      format: fromKmz ? 'KMZ' : 'KML',
      hint: networkLink
        ? 'В файле только сетевая ссылка на карту, без точек. В Google My Maps экспортируйте карту заново, ' +
          'сняв флажок про сетевую ссылку KML (network link)'
        : null
    };
  }
  if (root === 'gpx' && !fromKmz) {
    // togeojson отдаёт сначала треки и маршруты; метки (wpt) — главное в файле, ставим их первыми
    const { features } = gpx(doc);
    const isPoint = (f) => f.geometry?.type === 'Point';
    const ordered = [...features.filter(isPoint), ...features.filter((f) => !isPoint(f))];
    return { ...pointsFromGeoJSON(ordered), format: 'GPX', hint: null };
  }
  throw new Error(fromKmz ? 'KML внутри архива повреждён' : UNRECOGNIZED);
}

function pointsFromJson(source) {
  let data;
  try {
    data = JSON.parse(source);
  } catch {
    throw new Error('Файл JSON повреждён и не читается');
  }
  const isGeoJSON = Array.isArray(data) || data?.type === 'FeatureCollection' || data?.type === 'Feature';
  if (!isGeoJSON) throw new Error('В файле JSON нет точек GeoJSON');
  return { ...pointsFromGeoJSON(data), format: 'GeoJSON', hint: null };
}

// Текстовый файл: XML → KML/GPX, JSON → GeoJSON, иначе CSV
function pointsFromSource(source) {
  const start = source.trimStart()[0];
  if (start === '<') return pointsFromXml(source, false);
  if (start === '{' || start === '[') return pointsFromJson(source);
  return pointsFromText(source);
}

function pointsFromText(source) {
  // нулевые байты в тексте — признак двоичного файла (картинка, PDF), а не таблицы
  if (source.includes('\u0000')) throw new Error(UNRECOGNIZED);
  const { recognized, ...result } = pointsFromCsv(source);
  if (!recognized) throw new Error(UNRECOGNIZED);
  return { ...result, format: 'CSV' };
}

// Разбор файла пользователя. Формат определяется по содержимому (zip → KMZ или архив с файлом точек,
// XML → KML/GPX,
// JSON → GeoJSON, иначе CSV), поэтому работает и для файлов без расширения или с неверным.
// Возвращает { points, skipped, skipNotes, format }.
async function readPointsFile(file, { jszipTimeoutMs = JSZIP_TIMEOUT_MS } = {}) {
  if (!file) throw new Error('Файл не выбран');
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let result;
  if (isZip(bytes)) {
    if (containsAscii(bytes, 'xl/workbook')) {
      throw new Error('Это таблица Excel (XLSX). Сохраните её как CSV («Файл → Сохранить как → CSV») и выберите снова');
    }
    const { text: source, isKml } = await textFromZip(buffer, jszipTimeoutMs);
    result = isKml ? pointsFromXml(source, true) : pointsFromSource(source.replace(/^\uFEFF/, ''));
  } else {
    result = pointsFromSource(decodeText(bytes).replace(/^\uFEFF/, ''));
  }

  const { hint, ...rest } = result;
  if (rest.points.length === 0) {
    if (hint) throw new Error(hint);
    throw new Error(rest.skipped > 0
      ? `В файле нет пригодных точек. Пропущено: ${rest.skipNotes.join('; ')}`
      : 'В файле нет точек');
  }
  return rest;
}

export { firstCoordinate, pointsFromGeoJSON, readPointsFile };
