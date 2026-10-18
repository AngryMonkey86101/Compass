import { kml } from '@tmcw/togeojson';
import { isValidCoordinates } from './geoUtils';

// Импорт точек из KMZ/KML. Разбор отделён от интерфейса, чтобы его можно было тестировать.
// togeojson (~3 КБ gzip) — в основном бандле: KML разбирается без дополнительных загрузок,
// даже если сеть обрывает запросы. JSZip (~28 КБ gzip) нужен только для KMZ и подгружается
// по требованию с ограничением по времени.

const UNNAMED = 'Без названия';
const JSZIP_TIMEOUT_MS = 15000;

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

// Точки из GeoJSON: { points: [{ name, lat, lon }], skipped }.
// Объекты без геометрии или с координатами вне диапазона пропускаются и считаются.
// Безымянные получают номер («Без названия 1», «Без названия 2»…), повторы имён внутри
// одного файла — суффикс « (2)», « (3)»…, чтобы при импорте они не заменяли друг друга.
function pointsFromGeoJSON(geojson) {
  const points = [];
  let skipped = 0;
  let unnamedCount = 0;
  const seen = new Map();

  for (const feature of geojson?.features ?? []) {
    const coord = firstCoordinate(feature?.geometry);
    if (!coord || !isValidCoordinates(coord.lat, coord.lon)) {
      skipped += 1;
      continue;
    }

    const rawName = typeof feature.properties?.name === 'string' ? feature.properties.name.trim() : '';
    let name = rawName || `${UNNAMED} ${++unnamedCount}`;
    const times = (seen.get(name) ?? 0) + 1;
    seen.set(name, times);
    if (times > 1) name = `${name} (${times})`;

    points.push({ name, lat: coord.lat, lon: coord.lon });
  }

  return { points, skipped };
}

const isZip = (bytes) => bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

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

async function kmlTextFromKmz(buffer, jszipTimeoutMs) {
  const JSZip = await loadJSZip(jszipTimeoutMs);
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('Архив KMZ повреждён и не читается');
  }
  // По стандарту главный файл — doc.kml в корне; иначе берём первый .kml в архиве
  const kmlFiles = Object.values(zip.files).filter((entry) => !entry.dir && /\.kml$/i.test(entry.name));
  const main = kmlFiles.find((entry) => /(^|\/)doc\.kml$/i.test(entry.name)) ?? kmlFiles[0];
  if (!main) throw new Error('В архиве KMZ нет файла KML');
  return main.async('text');
}

// Разбор файла пользователя. Формат определяется по содержимому (zip → KMZ, иначе текст KML),
// поэтому работает и для файлов без расширения или с неверным расширением.
async function readPointsFile(file, { jszipTimeoutMs = JSZIP_TIMEOUT_MS } = {}) {
  if (!file) throw new Error('Файл не выбран');
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const isKmz = isZip(bytes);
  const text = isKmz ? await kmlTextFromKmz(buffer, jszipTimeoutMs) : new TextDecoder('utf-8').decode(bytes);

  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0 || !doc.documentElement ||
      doc.documentElement.localName.toLowerCase() !== 'kml') {
    throw new Error(isKmz ? 'KML внутри архива повреждён' : 'Это не файл KML или KMZ');
  }

  const result = pointsFromGeoJSON(kml(doc));
  if (result.points.length === 0) {
    throw new Error(result.skipped > 0
      ? `В файле нет пригодных точек: пропущено объектов — ${result.skipped}`
      : 'В файле нет точек');
  }
  return { ...result, format: isKmz ? 'KMZ' : 'KML' };
}

export { firstCoordinate, pointsFromGeoJSON, readPointsFile };
