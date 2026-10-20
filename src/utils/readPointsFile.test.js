import { describe, it, expect, beforeAll } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';
import { readPointsFile } from './importPoints';
import { buildExport, EXPORT_FORMATS } from './exportPoints';

// В Node нет DOMParser — для KML и GPX подставляем xmldom (togeojson с ним совместим).
// Повреждённый XML в браузере даёт <parsererror>, это проверяется в Playwright.
beforeAll(() => {
  globalThis.DOMParser = DOMParser;
});

const file = (content, name = 'points') => new File([content], name);

const KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Placemark><name>Плотинка</name><Point><coordinates>60.6035,56.838,0</coordinates></Point></Placemark>
</Document></kml>`;

const GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Yandex Map Constructor" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="56.838" lon="60.6035"><name>Плотинка</name><desc>Сквер</desc></wpt>
  <wpt lat="56.9425" lon="60.4718"><name>Ганина Яма</name></wpt>
  <trk><name>Прогулка</name><trkseg><trkpt lat="56.84" lon="60.61"/><trkpt lat="56.85" lon="60.62"/></trkseg></trk>
</gpx>`;

// Windows-1251: А–я = 0xC0–0xFF, ё = 0xB8, Ё = 0xA8; латиница и цифры совпадают с ASCII
const cp1251 = (text) => Uint8Array.from([...text].map((ch) => {
  const code = ch.charCodeAt(0);
  if (code < 0x80) return code;
  if (code >= 0x410 && code <= 0x44f) return code - 0x410 + 0xc0;
  if (ch === 'ё') return 0xb8;
  if (ch === 'Ё') return 0xa8;
  throw new Error(`нет в тесте: ${ch}`);
}));

describe('readPointsFile — определение формата по содержимому', () => {
  it('KML и GPX (метки и первая точка трека)', async () => {
    expect(await readPointsFile(file(KML, 'x.txt'))).toMatchObject({
      format: 'KML', points: [{ name: 'Плотинка', lat: 56.838, lon: 60.6035 }]
    });
    const gpx = await readPointsFile(file(GPX));
    expect(gpx.format).toBe('GPX');
    expect(gpx.points).toEqual([
      { name: 'Плотинка', lat: 56.838, lon: 60.6035 },
      { name: 'Ганина Яма', lat: 56.9425, lon: 60.4718 },
      { name: 'Прогулка', lat: 56.84, lon: 60.61 }
    ]);
  });

  it('KMZ: doc.kml в архиве, сетевая ссылка My Maps, архив Google Takeout', async () => {
    const zip = async (files) => {
      const z = new JSZip();
      for (const [name, content] of Object.entries(files)) z.file(name, content);
      return z.generateAsync({ type: 'uint8array' });
    };
    expect(await readPointsFile(file(await zip({ 'images/icon.png': 'x', 'doc.kml': KML }), 'map.kmz'))).toMatchObject({
      format: 'KMZ', points: [{ name: 'Плотинка', lat: 56.838, lon: 60.6035 }]
    });

    const networkLink = '<kml xmlns="http://www.opengis.net/kml/2.2"><Document><NetworkLink><name>Карта</name>' +
      '<Link><href>https://www.google.com/maps/d/kml?mid=1</href></Link></NetworkLink></Document></kml>';
    await expect(readPointsFile(file(await zip({ 'doc.kml': networkLink })))).rejects.toThrow(/сетевая ссылка/);

    const saved = JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature',
      geometry: { type: 'Point', coordinates: [60.6035, 56.838] }, properties: { location: { name: 'Плотинка' } } }] });
    const takeout = await zip({ 'Takeout/archive_browser.html': '<html></html>', 'Takeout/Maps (your places)/Saved Places.json': saved });
    expect(await readPointsFile(file(takeout, 'takeout.zip'))).toMatchObject({
      format: 'GeoJSON', points: [{ name: 'Плотинка', lat: 56.838, lon: 60.6035 }]
    });
    await expect(readPointsFile(file(await zip({ 'readme.txt': 'hi' })))).rejects.toThrow(/нет файла с точками/);
  });

  it('GPX: метка без name получает название из desc', async () => {
    const gpx = '<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><wpt lat="56.838" lon="60.6035"><desc>Плотинка</desc></wpt></gpx>';
    expect((await readPointsFile(file(gpx))).points).toEqual([{ name: 'Плотинка', lat: 56.838, lon: 60.6035 }]);
  });

  it('GeoJSON и CSV', async () => {
    const geojson = JSON.stringify({ type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { name: 'Дом' }, geometry: { type: 'Point', coordinates: [60.6, 56.8] } }
    ] });
    expect(await readPointsFile(file(geojson))).toMatchObject({ format: 'GeoJSON', points: [{ name: 'Дом', lat: 56.8, lon: 60.6 }] });
    expect(await readPointsFile(file('\uFEFFНазвание;Широта;Долгота\nДом;56,8;60,6\n'))).toMatchObject({
      format: 'CSV', points: [{ name: 'Дом', lat: 56.8, lon: 60.6 }]
    });
  });

  it('CSV в Windows-1251 из русского Excel', async () => {
    const bytes = cp1251('Название;Широта;Долгота\r\nЁлка у Плотинки;56,838;60,6035\r\n');
    expect((await readPointsFile(file(bytes))).points).toEqual([{ name: 'Ёлка у Плотинки', lat: 56.838, lon: 60.6035 }]);
  });

  it('понятные ошибки: XLSX, сетевая ссылка My Maps, чужой XML и JSON, нераспознанный текст', async () => {
    const xlsx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new TextEncoder().encode('....xl/workbook.xml....')]);
    await expect(readPointsFile(file(xlsx))).rejects.toThrow(/Excel/);

    const networkLink = '<kml xmlns="http://www.opengis.net/kml/2.2"><NetworkLink><name>Карта</name>' +
      '<Link><href>https://www.google.com/maps/d/kml?mid=1</href></Link></NetworkLink></kml>';
    await expect(readPointsFile(file(networkLink))).rejects.toThrow(/сетевая ссылка/);

    await expect(readPointsFile(file('<html><body>Привет</body></html>'))).rejects.toThrow(/не распознан/);
    await expect(readPointsFile(file('{"a": 1}'))).rejects.toThrow(/нет точек GeoJSON/);
    await expect(readPointsFile(file('{ сломано'))).rejects.toThrow(/JSON повреждён/);
    await expect(readPointsFile(file('Просто заметка без координат'))).rejects.toThrow(/не распознан/);
    await expect(readPointsFile(file('Title,Note,URL\nКафе,,http://maps.google.com/?cid=1\n'))).rejects.toThrow(/My Maps/);
    await expect(readPointsFile(file('Название;Широта;Долгота\nДом;x;y\n'))).rejects.toThrow(/нет пригодных точек.*строка 2/);
  });
});

describe('экспорт → импорт без потерь', () => {
  const points = [
    { id: 'a', name: 'Плотинка', lat: 56.838, lon: 60.6035 },
    { id: 'b', name: 'Кафе «Ёж» & <Ко>; "Тест"', lat: -33.868819, lon: 151.209295 },
    { id: 'c', name: 'Строка, с запятой', lat: 0.000001, lon: -179.999999 }
  ];
  const now = new Date(2026, 9, 20, 12, 0, 0);

  for (const format of Object.keys(EXPORT_FORMATS)) {
    it(format, async () => {
      const { name, mime, content } = buildExport(points, format, now);
      expect(name).toBe(`compass-points-2026-10-20.${EXPORT_FORMATS[format].extension}`);
      expect(mime).toBeTruthy();
      const result = await readPointsFile(new File([content], name, { type: mime }));
      expect(result.format).toBe(EXPORT_FORMATS[format].label);
      expect(result.skipped).toBe(0);
      expect(result.points.map((p) => ({ name: p.name, lat: p.lat.toFixed(6), lon: p.lon.toFixed(6) })))
        .toEqual(points.map((p) => ({ name: p.name, lat: p.lat.toFixed(6), lon: p.lon.toFixed(6) })));
    });
  }
});
