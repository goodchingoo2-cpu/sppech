import { describe, it, expect } from 'vitest';
import { phonemeToVisemes, consonantToViseme, expandVowelPhoneme } from '../../src/viseme/visemeMap.js';

describe('visemeMap.consonantToViseme', () => {
  it.each([
    ['M', 'V_M'], ['N', 'V_N'], ['K', 'V_K'], ['S', 'V_S'], ['NG', 'V_NG'], ['_', 'V_REST'],
  ] as const)('%s → %s', (c, expected) => {
    expect(consonantToViseme(c)).toBe(expected);
  });
});

describe('visemeMap.expandVowelPhoneme', () => {
  it('단순 모음은 1개', () => {
    expect(expandVowelPhoneme('A')).toEqual(['V_A']);
    expect(expandVowelPhoneme('I')).toEqual(['V_I']);
  });
  it('활음은 2개 펼침', () => {
    expect(expandVowelPhoneme('WA')).toEqual(['V_O', 'V_A']);
    expect(expandVowelPhoneme('WEO')).toEqual(['V_O', 'V_EO']);
    expect(expandVowelPhoneme('UI')).toEqual(['V_EO', 'V_I']);
  });
});

describe('visemeMap.phonemeToVisemes', () => {
  it('모음과 자음을 통합 처리', () => {
    expect(phonemeToVisemes('A')).toEqual(['V_A']);
    expect(phonemeToVisemes('M')).toEqual(['V_M']);
    expect(phonemeToVisemes('WA')).toEqual(['V_O', 'V_A']);
  });
});
