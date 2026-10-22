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

describe('параметры экрана', () => {
  it('группа и приглашение', async () => {
    const { parseRouteParam } = await import('./router');
    expect(parseRoute('#/group/AAAA')).toBe('group');
    expect(parseRouteParam('#/group/AAAA')).toBe('AAAA');
    expect(parseRouteParam('#/join/g.i.1.k')).toBe('g.i.1.k');
    expect(parseRouteParam('#/menu')).toBe('');
    expect(parseRouteParam('#/unknown/x')).toBe('');
    expect(hashFor('group', 'AAAA')).toBe('#/group/AAAA');
    expect(parseRoute(hashFor('join', 'x.y'))).toBe('join');
  });
});
