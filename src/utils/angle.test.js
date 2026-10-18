import { describe, it, expect } from 'vitest';
import { shortestDelta, smoothAngle } from './angle';

describe('shortestDelta', () => {
  it('идёт по кратчайшей дуге через север', () => {
    expect(shortestDelta(350, 10)).toBe(20);
    expect(shortestDelta(10, 350)).toBe(-20);
  });

  it('учитывает накопленные углы больше 360', () => {
    expect(shortestDelta(725, 10)).toBe(5);
    expect(shortestDelta(-370, 0)).toBe(10);
  });

  it('равна нулю для одинаковых направлений', () => {
    expect(shortestDelta(0, 360)).toBe(0);
  });
});

describe('smoothAngle', () => {
  it('за время tau проходит ~63% пути', () => {
    expect(smoothAngle(0, 100, 150, 150)).toBeCloseTo(63.2, 1);
  });

  it('не зависит от частоты кадров', () => {
    let fast = 0;
    for (let i = 0; i < 4; i++) fast = smoothAngle(fast, 40, 25, 150);
    const slow = smoothAngle(0, 40, 100, 150);
    expect(fast).toBeCloseTo(slow, 6);
  });

  it('поворачивает через север, а не в обратную сторону', () => {
    const next = smoothAngle(350, 10, 1000, 150);
    expect(next).toBeGreaterThan(350);
    expect(next).toBeCloseTo(370, 1);
  });

  it('гасит шум вокруг постоянного направления', () => {
    let angle = 90;
    let maxDeviation = 0;
    for (let i = 0; i < 300; i++) {
      const noisy = 90 + (i % 2 === 0 ? 2 : -2); // худший случай: скачки ±2° каждый кадр
      angle = smoothAngle(angle, noisy, 16, 150);
      maxDeviation = Math.max(maxDeviation, Math.abs(angle - 90));
    }
    expect(maxDeviation).toBeLessThan(0.25);
  });
});
