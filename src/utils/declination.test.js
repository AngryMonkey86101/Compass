import { describe, it, expect } from 'vitest';
import { decimalYear, formatDeclination, geomagneticField, magneticDeclination } from './declination';

// Контрольные значения WMM2025 (NOAA): год, высота км, широта, долгота → X, Y, Z (нТл), D (°)
const TEST_VALUES = [
  [2025.0, 28, 89, -121, -255.388723, -1482.460628, 56194.288771, -99.77],
  [2025.0, 65, 43, 93, 24299.852822, 210.517066, 50037.923998, 0.50],
  [2025.0, 51, -33, 109, 21737.778822, -2090.274098, -52710.003920, -5.49],
  [2027.5, 8, 62, 53, 12260.425578, 4315.497527, 54849.810218, 19.39],
  [2027.5, 73, -72, 95, -2912.418045, -12984.118939, -55399.217725, -102.64],
  [2029.5, 31, 13, -132, 27795.620707, 4421.061344, 17187.983590, 9.04],
  [2029.5, 93, -2, 158, 33806.520595, 4207.156292, -10964.647547, 7.09]
];

describe('geomagneticField', () => {
  it.each(TEST_VALUES)('совпадает с контрольными значениями WMM2025: %s, %s км, %s°, %s°',
    (year, alt, lat, lon, x, y, z, decl) => {
      const field = geomagneticField(lat, lon, alt, year);
      expect(field.x).toBeCloseTo(x, 1);
      expect(field.y).toBeCloseTo(y, 1);
      expect(field.z).toBeCloseTo(z, 1);
      expect(Math.atan2(field.y, field.x) * 180 / Math.PI).toBeCloseTo(decl, 1);
    });
});

describe('magneticDeclination', () => {
  const date = new Date('2026-10-23T00:00:00Z');

  it('восточное в Екатеринбурге и Москве, западное во Владивостоке', () => {
    expect(magneticDeclination(56.838, 60.6035, date)).toBeGreaterThan(15);
    expect(magneticDeclination(56.838, 60.6035, date)).toBeLessThan(16);
    expect(magneticDeclination(55.7539, 37.6208, date)).toBeCloseTo(12.1, 0);
    expect(magneticDeclination(43.1155, 131.8855, date)).toBeLessThan(-10);
  });

  it('на полюсах даёт число, а не NaN', () => {
    expect(Number.isFinite(magneticDeclination(90, 0, date))).toBe(true);
    expect(Number.isFinite(magneticDeclination(-90, 45, date))).toBe(true);
  });

  it('после 2030 года не уходит в экстраполяцию', () => {
    expect(magneticDeclination(56.838, 60.6035, new Date('2035-01-01T00:00:00Z')))
      .toBeCloseTo(magneticDeclination(56.838, 60.6035, new Date('2030-01-01T00:00:00Z')), 6);
  });
});

describe('decimalYear', () => {
  it('начало и середина года', () => {
    expect(decimalYear(new Date('2026-01-01T00:00:00Z'))).toBe(2026);
    expect(decimalYear(new Date('2026-07-02T12:00:00Z'))).toBeCloseTo(2026.5, 2);
  });
});

describe('formatDeclination', () => {
  it('знак и запятая', () => {
    expect(formatDeclination(15.47)).toBe('+15,5°');
    expect(formatDeclination(-10.89)).toBe('−10,9°');
    expect(formatDeclination(0)).toBe('+0,0°');
  });
});
