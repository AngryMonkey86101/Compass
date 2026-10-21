// Экспорт точек в файлы KML, GPX, CSV и GeoJSON. Каждый формат читается импортом Компаса обратно
// без потерь (координаты — 6 знаков после точки, ≈10 см). Сборка файла синхронная: на iOS меню
// «Поделиться» открывается только в том же нажатии, без ожиданий перед navigator.share.

import { protectFormula } from './text';

const DOC_NAME = 'Компас — точки';
const fixed = (n) => n.toFixed(6);

// Управляющие символы (кроме табуляции и переводов строки) в XML 1.0 запрещены даже в виде
// сущностей: строгий разборщик отвергнет весь файл, поэтому они удаляются
// eslint-disable-next-line no-control-regex
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

const escapeXml = (value) => String(value)
  .replace(XML_INVALID, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// KML: Google Earth, Google My Maps (импорт слоя), Конструктор карт Яндекса
function toKml(points) {
  const placemarks = points.map((p) =>
    `    <Placemark>\n      <name>${escapeXml(p.name)}</name>\n` +
    `      <Point><coordinates>${fixed(p.lon)},${fixed(p.lat)},0</coordinates></Point>\n    </Placemark>`
  ).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n' +
    `    <name>${escapeXml(DOC_NAME)}</name>\n${placemarks}\n  </Document>\n</kml>\n`;
}

// GPX 1.1: навигаторы (OsmAnd, Organic Maps, Locus, Garmin)
function toGpx(points, now = new Date()) {
  const waypoints = points.map((p) =>
    `  <wpt lat="${fixed(p.lat)}" lon="${fixed(p.lon)}">\n    <name>${escapeXml(p.name)}</name>\n  </wpt>`
  ).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<gpx version="1.1" creator="Compass" xmlns="http://www.topografix.com/GPX/1/1">\n' +
    `  <metadata>\n    <name>${escapeXml(DOC_NAME)}</name>\n    <time>${now.toISOString()}</time>\n  </metadata>\n` +
    `${waypoints}\n</gpx>\n`;
}

// Ячейка CSV: кавычки при необходимости и апостроф перед текстом, похожим на формулу
// (импорт Компаса его снимает — см. utils/text.js)
const csvCell = (value) => {
  const text = protectFormula(String(value));
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// CSV в порядке столбцов Конструктора карт Яндекса (широта, долгота, описание, подпись),
// разделитель «;» и метка UTF-8 в начале — так русский Excel открывает файл без искажений
function toCsv(points) {
  const rows = points.map((p) => [fixed(p.lat), fixed(p.lon), '', csvCell(p.name)].join(';'));
  return '\uFEFF' + ['Широта;Долгота;Описание;Подпись', ...rows].join('\r\n') + '\r\n';
}

// GeoJSON: геоинформационные программы; iconCaption — подпись метки в Конструкторе Яндекса
function toGeoJson(points) {
  return JSON.stringify({
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      properties: { name: p.name, iconCaption: p.name },
      geometry: { type: 'Point', coordinates: [Number(fixed(p.lon)), Number(fixed(p.lat))] }
    }))
  }, null, 2) + '\n';
}

const EXPORT_FORMATS = {
  kml: { label: 'KML', extension: 'kml', mime: 'application/vnd.google-earth.kml+xml', build: toKml },
  gpx: { label: 'GPX', extension: 'gpx', mime: 'application/gpx+xml', build: toGpx },
  csv: { label: 'CSV', extension: 'csv', mime: 'text/csv', build: toCsv },
  geojson: { label: 'GeoJSON', extension: 'geojson', mime: 'application/geo+json', build: toGeoJson }
};

const pad = (n) => String(n).padStart(2, '0');

// compass-points-2026-10-20.kml (дата по местному времени)
function exportFileName(extension, now = new Date()) {
  return `compass-points-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.${extension}`;
}

// { name, mime, content } для выбранного формата
function buildExport(points, format, now = new Date()) {
  const spec = EXPORT_FORMATS[format];
  if (!spec) throw new Error(`Неизвестный формат экспорта: ${format}`);
  const list = points.map(({ name, lat, lon }) => ({ name, lat, lon }));
  return { name: exportFileName(spec.extension, now), mime: spec.mime, content: spec.build(list, now) };
}

export { EXPORT_FORMATS, buildExport, exportFileName, toKml, toGpx, toCsv, toGeoJson };
