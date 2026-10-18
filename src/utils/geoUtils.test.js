import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  formatDistance,
  calculateBearing,
  isValidCoordinates,
  parseCoordinates
} from './geoUtils';

describe('calculateDistance', () => {
  it('равно нулю для одной и той же точки', () => {
    expect(calculateDistance(55.75, 37.62, 55.75, 37.62)).toBe(0);
  });

  it('Москва — Париж ≈ 2490 км', () => {
    expect(calculateDistance(55.7535, 37.621, 48.8584, 2.2945)).toBeCloseTo(2490, -1);
  });

  it('градус по экватору ≈ 111.2 км', () => {
    expect(calculateDistance(0, 0, 0, 1)).toBeCloseTo(111.19, 1);
  });

  it('корректно пересекает антимеридиан', () => {
    expect(calculateDistance(0, 179.5, 0, -179.5)).toBeCloseTo(111.19, 1);
  });
});

describe('formatDistance', () => {
  it('до километра показывает метры', () => {
    expect(formatDistance(0.997)).toBe('997 м');
  });

  it('не выдаёт «1000 м» при округлении', () => {
    expect(formatDistance(0.9996)).toBe('1.0 км');
  });

  it('от километра показывает километры', () => {
    expect(formatDistance(12.34)).toBe('12.3 км');
  });
});

describe('calculateBearing', () => {
  it('на север, восток, юг, запад по экватору/меридиану', () => {
    expect(calculateBearing(0, 0, 10, 0)).toBeCloseTo(0);
    expect(calculateBearing(0, 0, 0, 10)).toBeCloseTo(90);
    expect(calculateBearing(0, 0, -10, 0)).toBeCloseTo(180);
    expect(calculateBearing(0, 0, 0, -10)).toBeCloseTo(270);
  });

  it('на Северный полюс откуда угодно — строго на север', () => {
    expect(calculateBearing(55.75, 37.62, 90, 0)).toBeCloseTo(0);
    expect(calculateBearing(-33.86, 151.21, 90, 0)).toBeCloseTo(0);
  });

  it('всегда в диапазоне [0, 360)', () => {
    const b = calculateBearing(10, 10, 5, -20);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });
});

describe('isValidCoordinates', () => {
  it('принимает границы и отклоняет выход за них', () => {
    expect(isValidCoordinates(90, 180)).toBe(true);
    expect(isValidCoordinates(-90, -180)).toBe(true);
    expect(isValidCoordinates(90.1, 0)).toBe(false);
    expect(isValidCoordinates(0, 180.1)).toBe(false);
    expect(isValidCoordinates(NaN, 0)).toBe(false);
  });
});

describe('parseCoordinates', () => {
  it('разбирает точку, запятую и пробел как разделители', () => {
    expect(parseCoordinates('55.7535, 37.6210')).toEqual({ lat: 55.7535, lon: 37.621 });
    expect(parseCoordinates('55,75; 37,62')).toEqual({ lat: 55.75, lon: 37.62 });
    expect(parseCoordinates('-33.86 151.21')).toEqual({ lat: -33.86, lon: 151.21 });
  });

  it('отклоняет мусор, неполный ввод и неоднозначные записи', () => {
    for (const input of ['', '55.75', '55abc, 37', '55,37']) {
      expect(parseCoordinates(input).error).toBeTruthy();
    }
  });

  it('отклоняет координаты вне диапазона', () => {
    expect(parseCoordinates('91, 10').error).toMatch(/Широта/);
    expect(parseCoordinates('10, 181').error).toMatch(/Долгота/);
  });
});
