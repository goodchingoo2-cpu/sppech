import { describe, it, expect } from 'vitest';
import {
  BILABIALS,
  ALVEOLARS,
  ROUND_VOWELS,
  T5_TRIGGER_VOWELS,
  CONSONANT_TONGUE_MAP,
  VOWEL_LIP_MAP,
  VOWEL_TONGUE_MAP,
  requiresT5,
  getConsonantTongue,
  getVowelLip,
  getVowelTongue,
} from '../src/viseme/visemeTable.js';

describe('집합 상수 검증', () => {
  it('BILABIALS: ㅁ,ㅂ,ㅃ,ㅍ 포함', () => {
    expect(BILABIALS.has('ㅁ')).toBe(true);
    expect(BILABIALS.has('ㅂ')).toBe(true);
    expect(BILABIALS.has('ㅃ')).toBe(true);
    expect(BILABIALS.has('ㅍ')).toBe(true);
    expect(BILABIALS.has('ㄴ')).toBe(false);
  });

  it('ALVEOLARS: ㄴ,ㄷ,ㅅ,ㅈ 포함', () => {
    expect(ALVEOLARS.has('ㄴ')).toBe(true);
    expect(ALVEOLARS.has('ㄷ')).toBe(true);
    expect(ALVEOLARS.has('ㅅ')).toBe(true);
    expect(ALVEOLARS.has('ㄱ')).toBe(false);
  });

  it('ROUND_VOWELS: ㅗ,ㅜ 포함', () => {
    expect(ROUND_VOWELS.has('ㅗ')).toBe(true);
    expect(ROUND_VOWELS.has('ㅜ')).toBe(true);
    expect(ROUND_VOWELS.has('ㅏ')).toBe(false);
  });

  it('T5_TRIGGER_VOWELS: ㅑ,ㅟ,ㅣ 포함', () => {
    expect(T5_TRIGGER_VOWELS.has('ㅑ')).toBe(true);
    expect(T5_TRIGGER_VOWELS.has('ㅟ')).toBe(true);
    expect(T5_TRIGGER_VOWELS.has('ㅣ')).toBe(true);
    expect(T5_TRIGGER_VOWELS.has('ㅏ')).toBe(false);
  });
});

describe('CONSONANT_TONGUE_MAP', () => {
  it('ㄴ → T1', () => expect(CONSONANT_TONGUE_MAP['ㄴ']).toBe('T1'));
  it('ㄷ → T1', () => expect(CONSONANT_TONGUE_MAP['ㄷ']).toBe('T1'));
  it('ㄹ → T1', () => expect(CONSONANT_TONGUE_MAP['ㄹ']).toBe('T1'));
  it('ㅈ → T2', () => expect(CONSONANT_TONGUE_MAP['ㅈ']).toBe('T2'));
  it('ㅊ → T2', () => expect(CONSONANT_TONGUE_MAP['ㅊ']).toBe('T2'));
  it('ㄱ → T3', () => expect(CONSONANT_TONGUE_MAP['ㄱ']).toBe('T3'));
  it('ㄲ → T3', () => expect(CONSONANT_TONGUE_MAP['ㄲ']).toBe('T3'));
  it('ㅋ → T3', () => expect(CONSONANT_TONGUE_MAP['ㅋ']).toBe('T3'));
  it('ㅂ → T4', () => expect(CONSONANT_TONGUE_MAP['ㅂ']).toBe('T4'));
  it('ㅍ → T4', () => expect(CONSONANT_TONGUE_MAP['ㅍ']).toBe('T4'));
  it('ㅇ → T6', () => expect(CONSONANT_TONGUE_MAP['ㅇ']).toBe('T6'));
  it('ㅎ → T7', () => expect(CONSONANT_TONGUE_MAP['ㅎ']).toBe('T7'));
});

describe('VOWEL_LIP_MAP', () => {
  it('ㅏ → L1', () => expect(VOWEL_LIP_MAP['ㅏ']).toBe('L1'));
  it('ㅐ → L2', () => expect(VOWEL_LIP_MAP['ㅐ']).toBe('L2'));
  it('ㅔ → L2', () => expect(VOWEL_LIP_MAP['ㅔ']).toBe('L2'));
  it('ㅓ → L3', () => expect(VOWEL_LIP_MAP['ㅓ']).toBe('L3'));
  it('ㅗ → L4', () => expect(VOWEL_LIP_MAP['ㅗ']).toBe('L4'));
  it('ㅜ → L5', () => expect(VOWEL_LIP_MAP['ㅜ']).toBe('L5'));
  it('ㅡ → L6', () => expect(VOWEL_LIP_MAP['ㅡ']).toBe('L6'));
  it('ㅣ → L7', () => expect(VOWEL_LIP_MAP['ㅣ']).toBe('L7'));
});

describe('VOWEL_TONGUE_MAP', () => {
  it('ㅣ → VT1', () => expect(VOWEL_TONGUE_MAP['ㅣ']).toBe('VT1'));
  it('ㅏ → VT2', () => expect(VOWEL_TONGUE_MAP['ㅏ']).toBe('VT2'));
  it('ㅓ → VT3', () => expect(VOWEL_TONGUE_MAP['ㅓ']).toBe('VT3'));
  it('ㅗ → VT4', () => expect(VOWEL_TONGUE_MAP['ㅗ']).toBe('VT4'));
  it('ㅜ → VT4', () => expect(VOWEL_TONGUE_MAP['ㅜ']).toBe('VT4'));
});

describe('requiresT5', () => {
  it('ㄴ + ㅣ → true', () => expect(requiresT5('ㄴ', 'ㅣ')).toBe(true));
  it('ㄷ + ㅑ → true', () => expect(requiresT5('ㄷ', 'ㅑ')).toBe(true));
  it('ㄴ + ㅏ → false', () => expect(requiresT5('ㄴ', 'ㅏ')).toBe(false));
  it('ㄱ + ㅣ → false (연구개음은 T5 아님)', () => expect(requiresT5('ㄱ', 'ㅣ')).toBe(false));
});

describe('getConsonantTongue', () => {
  it('ㅂ → T4 (nextVowel 없음)', () => expect(getConsonantTongue('ㅂ')).toBe('T4'));
  it('ㄴ + ㅣ → T5', () => expect(getConsonantTongue('ㄴ', 'ㅣ')).toBe('T5'));
  it('ㄴ + ㅏ → T1', () => expect(getConsonantTongue('ㄴ', 'ㅏ')).toBe('T1'));
  it('ㄱ + ㅣ → T3 (T5 아님)', () => expect(getConsonantTongue('ㄱ', 'ㅣ')).toBe('T3'));
});

describe('getVowelLip', () => {
  it('ㅏ → L1', () => expect(getVowelLip('ㅏ')).toBe('L1'));
  it('ㅣ → L7', () => expect(getVowelLip('ㅣ')).toBe('L7'));
  it('이중모음 ㅑ → 기저음 ㅏ → L1', () => expect(getVowelLip('ㅑ')).toBe('L1'));
  it('이중모음 ㅘ → 기저음 ㅏ → L1', () => expect(getVowelLip('ㅘ')).toBe('L1'));
  it('semivowelPart=true, j계열 ㅑ → L8', () => expect(getVowelLip('ㅑ', true)).toBe('L8'));
  it('semivowelPart=true, w계열 ㅘ → L9', () => expect(getVowelLip('ㅘ', true)).toBe('L9'));
});

describe('getVowelTongue', () => {
  it('ㅏ → VT2', () => expect(getVowelTongue('ㅏ')).toBe('VT2'));
  it('ㅣ → VT1', () => expect(getVowelTongue('ㅣ')).toBe('VT1'));
  it('ㅗ → VT4', () => expect(getVowelTongue('ㅗ')).toBe('VT4'));
  it('이중모음 ㅑ → 기저음 ㅏ → VT2', () => expect(getVowelTongue('ㅑ')).toBe('VT2'));
  it('이중모음 ㅜ 기반 ㅝ → 기저음 ㅓ → VT3', () => expect(getVowelTongue('ㅝ')).toBe('VT3'));
});
