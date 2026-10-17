import { describe, it, expect } from 'vitest';
import { firstCoordinate, pointsFromGeoJSON } from './importPoints';

describe('firstCoordinate', () => {
  it('точка с высотой (как пишет Google Earth) и без неё', () => {
    expect(firstCoordinate({ type: 'Point', coordinates: [37.621, 55.7535, 0] })).toEqual({ lon: 37.621, lat: 55.7535 });
    expect(firstCoordinate({ type: 'Point', coordinates: [30.3351, 59.9343] })).toEqual({ lon: 30.3351, lat: 59.9343 });
  });

  it('линия и полигон с высотой — первая вершина', () => {
    expect(firstCoordinate({ type: 'LineString', coordinates: [[37.6, 55.7, 0], [37.7, 55.8, 0]] }))
      .toEqual({ lon: 37.6, lat: 55.7 });
    expect(firstCoordinate({ type: 'Polygon', coordinates: [[[37.6, 55.7, 12], [37.7, 55.8, 12], [37.6, 55.7, 12]]] }))
      .toEqual({ lon: 37.6, lat: 55.7 });
  });

  it('мультигеометрия и коллекция', () => {
    expect(firstCoordinate({ type: 'MultiPoint', coordinates: [[10, 20, 0], [11, 21, 0]] })).toEqual({ lon: 10, lat: 20 });
    expect(firstCoordinate({
      type: 'GeometryCollection',
      geometries: [{ type: 'LineString', coordinates: [] }, { type: 'Point', coordinates: [5, 6, 0] }]
    })).toEqual({ lon: 5, lat: 6 });
  });

  it('пустая или отсутствующая геометрия', () => {
    expect(firstCoordinate(null)).toBeNull();
    expect(firstCoordinate({ type: 'Point', coordinates: [] })).toBeNull();
    expect(firstCoordinate({ type: 'Point', coordinates: [5] })).toBeNull();
  });
});

const point = (name, coordinates) => ({ type: 'Feature', properties: { name }, geometry: { type: 'Point', coordinates } });

describe('pointsFromGeoJSON', () => {
  it('собирает точки и считает пропущенные', () => {
    const result = pointsFromGeoJSON({
      features: [
        point('Дом', [37.6, 55.7, 0]),
        { type: 'Feature', properties: { name: 'Без геометрии' }, geometry: null },
        point('Вне диапазона', [200, 95, 0]),
        { type: 'Feature', properties: { name: 'Маршрут' }, geometry: { type: 'LineString', coordinates: [[30.3, 59.9, 0], [30.4, 59.95, 0]] } }
      ]
    });
    expect(result.points).toEqual([
      { name: 'Дом', lat: 55.7, lon: 37.6 },
      { name: 'Маршрут', lat: 59.9, lon: 30.3 }
    ]);
    expect(result.skipped).toBe(2);
  });

  it('нумерует безымянные и повторяющиеся имена внутри файла', () => {
    const { points } = pointsFromGeoJSON({
      features: [point('', [1, 1]), point(undefined, [2, 2]), point('  Лагерь ', [3, 3]), point('Лагерь', [4, 4])]
    });
    expect(points.map((p) => p.name)).toEqual(['Без названия 1', 'Без названия 2', 'Лагерь', 'Лагерь (2)']);
  });

  it('пустой или некорректный GeoJSON', () => {
    expect(pointsFromGeoJSON(null)).toEqual({ points: [], skipped: 0 });
    expect(pointsFromGeoJSON({ features: [] })).toEqual({ points: [], skipped: 0 });
  });
});
