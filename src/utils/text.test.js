import { describe, it, expect } from 'vitest';
import { firstLine, protectFormula, unprotectFormula } from './text';

describe('firstLine', () => {
  it('первая строка, обрезка по символам, эмодзи не разрезается', () => {
    expect(firstLine('  Ганина Яма\nмонастырь')).toBe('Ганина Яма');
    const cut = firstLine('😀'.repeat(100), 80);
    expect(Array.from(cut)).toHaveLength(80);
    expect(cut.endsWith('😀')).toBe(true);
  });
});

describe('защита от формул в CSV', () => {
  it('апостроф ставится и снимается без потерь', () => {
    for (const name of ['=HYPERLINK("http://x","y")', '+7 кафе', '-5 км', '@home', "'уже с апострофом", 'Плотинка']) {
      expect(unprotectFormula(protectFormula(name))).toBe(name);
    }
    expect(protectFormula('=1+1')).toBe("'=1+1");
    expect(protectFormula('Плотинка')).toBe('Плотинка');
  });
});
