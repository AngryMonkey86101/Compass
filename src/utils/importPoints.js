import { isValidCoordinates } from './geoUtils';

// Импорт точек из KMZ/KML. Разбор отделён от интерфейса, чтобы его можно было тестировать.
// Тяжёлые библиотеки (JSZip, togeojson) подгружаются только при выборе файла —
// стартовый бандл приложения от импорта не растёт.

const UNNAMED = 'Без названия';

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

async function kmlTextFromKmz(buffer) {
  const { default: JSZip } = await import('jszip');
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
async function readPointsFile(file) {
  if (!file) throw new Error('Файл не выбран');
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const isKmz = isZip(bytes);
  const text = isKmz ? await kmlTextFromKmz(buffer) : new TextDecoder('utf-8').decode(bytes);

  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0 || !doc.documentElement ||
      doc.documentElement.localName.toLowerCase() !== 'kml') {
    throw new Error(isKmz ? 'KML внутри архива повреждён' : 'Это не файл KML или KMZ');
  }

  const { kml } = await import('@tmcw/togeojson');
  const result = pointsFromGeoJSON(kml(doc));
  if (result.points.length === 0) {
    throw new Error(result.skipped > 0
      ? `В файле нет пригодных точек: пропущено объектов — ${result.skipped}`
      : 'В файле нет точек');
  }
  return { ...result, format: isKmz ? 'KMZ' : 'KML' };
}

export { firstCoordinate, pointsFromGeoJSON, readPointsFile };
