import { kml, gpx } from '@tmcw/togeojson';
import { createPointCollector } from './pointCollector';
import { pointsFromCsv } from './csvPoints';
import { parseMapUrl } from './locationText';
import { firstLine } from './text';

// Импорт точек из KMZ, KML, GPX, GeoJSON и CSV. Разбор отделён от интерфейса, чтобы его можно было тестировать.
// togeojson (~3 КБ gzip) — в основном бандле: KML и GPX разбираются без дополнительных загрузок,
// даже если сеть обрывает запросы. JSZip (~28 КБ gzip) нужен только для KMZ и подгружается
// по требованию с ограничением по времени.

const JSZIP_TIMEOUT_MS = 15000;
// Файлы точек — килобайты, редко мегабайты. Лимиты защищают от зависания на случайно выбранном
// видео и от zip-бомбы (маленький архив, распаковывающийся в сотни мегабайт)
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_UNZIPPED_BYTES = 50 * 1024 * 1024;
// Глубже в GeoJSON не бывает даже у мультиполигонов; защита от переполнения стека на битом файле
const MAX_GEOMETRY_DEPTH = 16;

const UNRECOGNIZED = 'Формат файла не распознан. Поддерживаются KML, KMZ, GPX, GeoJSON и CSV';
const JSZIP_FAILED = 'Модуль для KMZ не загрузился — проверьте сеть и выберите файл снова или используйте .kml';
const TOO_BIG = 'Файл слишком большой (больше 50 МБ). Файлы с точками обычно занимают килобайты';
const BROKEN = 'Файл повреждён или имеет неожиданную структуру';

// Первая пара «долгота, широта» из любой геометрии GeoJSON: точка, линия, полигон,
// мульти-варианты и коллекции. Координаты могут содержать высоту ([lon, lat, alt]) —
// Google Earth пишет её всегда, поэтому берём первые два числа при любой длине.
function firstCoordinate(geometry, depth = 0) {
  if (!geometry || typeof geometry !== 'object' || depth > MAX_GEOMETRY_DEPTH) return null;
  if (geometry.type === 'GeometryCollection') {
    if (!Array.isArray(geometry.geometries)) return null;
    for (const inner of geometry.geometries) {
      const found = firstCoordinate(inner, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const walk = (value, level) => {
    if (!Array.isArray(value) || value.length === 0 || level > MAX_GEOMETRY_DEPTH) return null;
    if (typeof value[0] === 'number') {
      return value.length >= 2 && typeof value[1] === 'number' ? { lon: value[0], lat: value[1] } : null;
    }
    for (const item of value) {
      const found = walk(item, level + 1);
      if (found) return found;
    }
    return null;
  };
  return walk(geometry.coordinates, 0);
}

const text = (value) => (typeof value === 'string' ? value.trim() : '');

// Название из свойств разных источников: KML/GPX/наш экспорт (name), Конструктор Яндекса
// (iconCaption, description), Google Takeout (location.name, Title, Location → Business Name),
// GPX без name (desc, cmt)
function featureName(props = {}) {
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

// Объект в формате Google Takeout («Мои места»): у него есть ссылка на место или блок location
const isTakeoutFeature = (props) =>
  'google_maps_url' in props || 'Google Maps URL' in props || 'location' in props || 'Location' in props;

// Точки из GeoJSON: { points: [{ name, lat, lon }], skipped, skipNotes }.
// Google Takeout пишет 0,0, если не знает координат места: такие объекты пропускаются отдельно,
// если координаты не нашлись в других полях. В остальных файлах 0,0 — обычная точка.
function pointsFromGeoJSON(geojson) {
  const collector = createPointCollector();
  let features = [];
  if (Array.isArray(geojson)) features = geojson;
  else if (geojson?.type === 'Feature') features = [geojson];
  else if (Array.isArray(geojson?.features)) features = geojson.features;

  for (const feature of features) {
    const props = feature?.properties && typeof feature.properties === 'object' ? feature.properties : {};
    let coord = firstCoordinate(feature?.geometry);
    const unknown = coord && coord.lat === 0 && coord.lon === 0 && isTakeoutFeature(props);
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

// Загрузка JSZip с ограничением по времени: при обрыве сети import() может висеть бесконечно
function loadJSZip(timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(JSZIP_FAILED)), timeoutMs);
  });
  const load = import('jszip').then(
    (module) => module.default,
    () => {
      throw new Error(JSZIP_FAILED);
    }
  );
  return Promise.race([load, timeout]).finally(() => clearTimeout(timer));
}

// Размер распакованного файла из заголовка архива. Поле внутреннее (_data — CompressedObject
// в JSZip 3.x), публичного способа узнать размер до распаковки нет. Если поля нет — проверка
// пропускается; ложный размер в заголовке JSZip сам отвергнет после распаковки.
const unzippedSize = (entry) => entry._data?.uncompressedSize ?? 0;

async function readEntry(entry) {
  if (unzippedSize(entry) > MAX_UNZIPPED_BYTES) throw new Error(TOO_BIG);
  return decodeText(await entry.async('uint8array'));
}

// Точки из архива: KMZ (главный — doc.kml в корне, иначе первый .kml) или обычный zip,
// например архив Google Takeout, с GPX, GeoJSON или CSV внутри. Кандидаты перебираются по
// очереди, пока один не даст точки: в Takeout на другом языке «Saved Places.json» называется
// иначе, и первым может попасться список CSV без координат.
async function pointsFromZip(buffer, jszipTimeoutMs) {
  const JSZip = await loadJSZip(jszipTimeoutMs);
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('Архив повреждён и не читается');
  }
  const entries = Object.values(zip.files).filter((entry) => !entry.dir && !/(^|\/)__MACOSX\//.test(entry.name));
  if (entries.some((entry) => /^xl\/workbook/i.test(entry.name))) {
    throw new Error('Это таблица Excel (XLSX). Сохраните её как CSV («Файл → Сохранить как → CSV») и выберите снова');
  }

  const kmlFiles = entries.filter((entry) => /\.kml$/i.test(entry.name));
  const mainKml = kmlFiles.find((entry) => /(^|\/)doc\.kml$/i.test(entry.name)) ?? kmlFiles[0];
  if (mainKml) return pointsFromXml(await readEntry(mainKml), true);

  const rank = (name) => {
    if (/(^|\/)saved places\.json$/i.test(name)) return 0;
    if (/\.geojson$/i.test(name)) return 1;
    if (/\.gpx$/i.test(name)) return 2;
    if (/\.json$/i.test(name)) return 3;
    if (/\.csv$/i.test(name)) return 4;
    return -1;
  };
  const candidates = entries.filter((entry) => rank(entry.name) >= 0).sort((a, b) => rank(a.name) - rank(b.name));
  if (candidates.length === 0) throw new Error('В архиве нет файла с точками (KML, GPX, GeoJSON или CSV)');

  let fallback = null;
  for (const entry of candidates) {
    try {
      const result = pointsFromSource(await readEntry(entry));
      if (result.points.length > 0) return result;
      fallback = fallback ?? result;
    } catch (err) {
      if (err.message === TOO_BIG) throw err;
      // файл в архиве не подошёл — пробуем следующий
    }
  }
  if (fallback) return fallback;
  throw new Error('В архиве нет файла с пригодными точками');
}

// Текст файла: UTF-8 (с меткой или без), UTF-16 с меткой (Excel «Юникод текст»), а если байты
// не подходят под UTF-8 — Windows-1251 (так сохраняет CSV русский Excel). Метка BOM убирается.
function decodeText(bytes) {
  let source;
  try {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) source = new TextDecoder('utf-16le').decode(bytes);
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) source = new TextDecoder('utf-16be').decode(bytes);
    else source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    try {
      source = new TextDecoder('windows-1251').decode(bytes);
    } catch {
      throw new Error('Не удалось прочитать текст файла');
    }
  }
  return source.replace(/^\uFEFF/, '');
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

// Разбор файла пользователя. Формат определяется по содержимому (zip → KMZ или архив с файлом
// точек, XML → KML/GPX, JSON → GeoJSON, иначе CSV), поэтому работает и для файлов без расширения или с неверным.
// Возвращает { points, skipped, skipNotes, format }.
async function readPointsFile(file, { jszipTimeoutMs = JSZIP_TIMEOUT_MS } = {}) {
  if (!file) throw new Error('Файл не выбран');
  if (file.size > MAX_FILE_BYTES) throw new Error(TOO_BIG);
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let result;
  try {
    result = isZip(bytes) ? await pointsFromZip(buffer, jszipTimeoutMs) : pointsFromSource(decodeText(bytes));
  } catch (err) {
    // Внутренние ошибки движка (TypeError, RangeError) на битом файле — по-английски и непонятны
    if (err instanceof TypeError || err instanceof RangeError) throw new Error(BROKEN);
    throw err;
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
