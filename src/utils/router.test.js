import { describe, it, expect } from 'vitest';
import { parseRoute, hashFor } from './router';

describe('parseRoute', () => {
  it('известные экраны и навигация по умолчанию', () => {
    expect(parseRoute('#/menu')).toBe('menu');
    expect(parseRoute('#/manual/')).toBe('manual');
    expect(parseRoute('#focus')).toBe('focus');
    expect(parseRoute('')).toBe('nav');
    expect(parseRoute('#/')).toBe('nav');
    expect(parseRoute('#/unknown')).toBe('nav');
  });

  it('адрес экрана и обратный разбор', () => {
    for (const route of ['nav', 'focus', 'menu', 'manual', 'qr', 'support']) {
      expect(parseRoute(hashFor(route))).toBe(route);
    }
    expect(hashFor('nav')).toBe('#/');
  });
});
