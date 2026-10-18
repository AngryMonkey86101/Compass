import { describe, it, expect } from 'vitest';
import { indexToLetters, accuracyTone } from './labels';

describe('indexToLetters', () => {
  it('однобуквенные метки A–Z', () => {
    expect(indexToLetters(0)).toBe('A');
    expect(indexToLetters(1)).toBe('B');
    expect(indexToLetters(25)).toBe('Z');
  });

  it('после Z идут AA, AB … AZ, BA', () => {
    expect(indexToLetters(26)).toBe('AA');
    expect(indexToLetters(27)).toBe('AB');
    expect(indexToLetters(51)).toBe('AZ');
    expect(indexToLetters(52)).toBe('BA');
  });

  it('после ZZ идёт AAA', () => {
    expect(indexToLetters(701)).toBe('ZZ');
    expect(indexToLetters(702)).toBe('AAA');
  });
});

describe('accuracyTone', () => {
  it('делит точность на три уровня', () => {
    expect(accuracyTone(8)).toBe('ok');
    expect(accuracyTone(15)).toBe('ok');
    expect(accuracyTone(30)).toBe('warn');
    expect(accuracyTone(120)).toBe('danger');
    expect(accuracyTone(undefined)).toBe('muted');
  });
});
