import { describe, it, expect } from 'vitest';
import { decomposeSyllable } from '../../src/korean/jamo.js';
import {
  syllableToPhonemes,
  choToPhoneme,
  jungToPhoneme,
  jongToPhoneme,
  isVowel,
} from '../../src/korean/phoneme.js';

describe('phoneme.choToPhoneme', () => {
  it.each([
    ['ㄱ', 'K'], ['ㄲ', 'K'], ['ㅋ', 'K'], ['ㅎ', 'K'],
    ['ㄴ', 'N'], ['ㄷ', 'N'], ['ㄹ', 'N'], ['ㅌ', 'N'],
    ['ㅁ', 'M'], ['ㅂ', 'M'], ['ㅍ', 'M'],
    ['ㅅ', 'S'], ['ㅈ', 'S'], ['ㅊ', 'S'],
    ['ㅇ', '_'],
  ] as const)('%s → %s', (cho, expected) => {
    expect(choToPhoneme(cho)).toBe(expected);
  });
});

describe('phoneme.jungToPhoneme', () => {
  it.each([
    ['ㅏ', 'A'], ['ㅑ', 'A'],
    ['ㅓ', 'EO'], ['ㅡ', 'EO'],
    ['ㅗ', 'O'], ['ㅜ', 'O'],
    ['ㅣ', 'I'], ['ㅔ', 'I'], ['ㅐ', 'I'],
    ['ㅘ', 'WA'], ['ㅝ', 'WEO'], ['ㅢ', 'UI'],
  ] as const)('%s → %s', (jung, expected) => {
    expect(jungToPhoneme(jung)).toBe(expected);
  });
});

describe('phoneme.jongToPhoneme', () => {
  it('받침 없음 → null', () => {
    expect(jongToPhoneme('')).toBeNull();
  });
  it.each([
    ['ㄱ', 'K'], ['ㄲ', 'K'], ['ㄺ', 'K'],
    ['ㄴ', 'N'], ['ㄹ', 'N'], ['ㄷ', 'N'], ['ㅅ', 'N'], ['ㅎ', 'N'],
    ['ㅁ', 'M'], ['ㅂ', 'M'], ['ㅄ', 'M'],
    ['ㅇ', 'NG'],
  ] as const)('받침 %s → %s', (jong, expected) => {
    expect(jongToPhoneme(jong)).toBe(expected);
  });
});

describe('phoneme.syllableToPhonemes', () => {
  it('한 = K+A+N', () => {
    expect(syllableToPhonemes(decomposeSyllable('한'))).toEqual({
      onset: 'K', nucleus: 'A', coda: 'N',
    });
  });
  it('글 = K+EO+N', () => {
    expect(syllableToPhonemes(decomposeSyllable('글'))).toEqual({
      onset: 'K', nucleus: 'EO', coda: 'N',
    });
  });
  it('와 = _+WA+null', () => {
    expect(syllableToPhonemes(decomposeSyllable('와'))).toEqual({
      onset: '_', nucleus: 'WA', coda: null,
    });
  });
});

describe('phoneme.isVowel', () => {
  it('모음 판별', () => {
    expect(isVowel('A')).toBe(true);
    expect(isVowel('WA')).toBe(true);
    expect(isVowel('M')).toBe(false);
    expect(isVowel('_')).toBe(false);
  });
});
