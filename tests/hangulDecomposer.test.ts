import { describe, it, expect } from 'vitest';
import {
  decomposeHangul,
  decomposeText,
  isDiphthong,
  getSemivowelType,
  getBaseVowel,
} from '../src/korean/hangulDecomposer.js';

describe('decomposeHangul', () => {
  it('아 → onset:ㅇ, vowel:ㅏ, coda:빈문자열', () => {
    expect(decomposeHangul('아')).toEqual({ onset: 'ㅇ', vowel: 'ㅏ', coda: '' });
  });

  it('닭 → onset:ㄷ, vowel:ㅏ, coda:ㄺ', () => {
    expect(decomposeHangul('닭')).toEqual({ onset: 'ㄷ', vowel: 'ㅏ', coda: 'ㄺ' });
  });

  it('뷁 → onset:ㅂ, vowel:ㅞ, coda:ㄺ', () => {
    expect(decomposeHangul('뷁')).toEqual({ onset: 'ㅂ', vowel: 'ㅞ', coda: 'ㄺ' });
  });

  it('가 → onset:ㄱ, vowel:ㅏ, coda:빈문자열', () => {
    expect(decomposeHangul('가')).toEqual({ onset: 'ㄱ', vowel: 'ㅏ', coda: '' });
  });

  it('밥 → onset:ㅂ, vowel:ㅏ, coda:ㅂ', () => {
    expect(decomposeHangul('밥')).toEqual({ onset: 'ㅂ', vowel: 'ㅏ', coda: 'ㅂ' });
  });

  it('한글이 아닌 문자 → null', () => {
    expect(decomposeHangul('A')).toBeNull();
    expect(decomposeHangul('1')).toBeNull();
    expect(decomposeHangul(' ')).toBeNull();
  });

  it('쌍자음 초성 처리: 짜 → onset:ㅉ', () => {
    const result = decomposeHangul('짜');
    expect(result?.onset).toBe('ㅉ');
  });

  it('이중모음 중성: 봐 → vowel:ㅘ', () => {
    const result = decomposeHangul('봐');
    expect(result?.vowel).toBe('ㅘ');
  });
});

describe('decomposeText', () => {
  it('아버지 → 3개 음절 분리', () => {
    const result = decomposeText('아버지');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ onset: 'ㅇ', vowel: 'ㅏ', coda: '' });
    expect(result[1]).toEqual({ onset: 'ㅂ', vowel: 'ㅓ', coda: '' });
    expect(result[2]).toEqual({ onset: 'ㅈ', vowel: 'ㅣ', coda: '' });
  });

  it('한글이 아닌 문자는 건너뜀', () => {
    const result = decomposeText('가A나');
    expect(result).toHaveLength(2);
    expect(result[0].onset).toBe('ㄱ');
    expect(result[1].onset).toBe('ㄴ');
  });

  it('빈 문자열 → 빈 배열', () => {
    expect(decomposeText('')).toEqual([]);
  });
});

describe('isDiphthong', () => {
  it('j계열 이중모음: ㅑ → true', () => expect(isDiphthong('ㅑ')).toBe(true));
  it('j계열 이중모음: ㅛ → true', () => expect(isDiphthong('ㅛ')).toBe(true));
  it('j계열 이중모음: ㅠ → true', () => expect(isDiphthong('ㅠ')).toBe(true));
  it('w계열 이중모음: ㅘ → true', () => expect(isDiphthong('ㅘ')).toBe(true));
  it('w계열 이중모음: ㅟ → true', () => expect(isDiphthong('ㅟ')).toBe(true));
  it('단모음: ㅏ → false', () => expect(isDiphthong('ㅏ')).toBe(false));
  it('단모음: ㅣ → false', () => expect(isDiphthong('ㅣ')).toBe(false));
  it('단모음: ㅗ → false', () => expect(isDiphthong('ㅗ')).toBe(false));
});

describe('getSemivowelType', () => {
  it('ㅑ → j', () => expect(getSemivowelType('ㅑ')).toBe('j'));
  it('ㅕ → j', () => expect(getSemivowelType('ㅕ')).toBe('j'));
  it('ㅘ → w', () => expect(getSemivowelType('ㅘ')).toBe('w'));
  it('ㅝ → w', () => expect(getSemivowelType('ㅝ')).toBe('w'));
  it('ㅏ → null', () => expect(getSemivowelType('ㅏ')).toBeNull());
  it('ㅣ → null', () => expect(getSemivowelType('ㅣ')).toBeNull());
});

describe('getBaseVowel', () => {
  it('ㅑ → ㅏ', () => expect(getBaseVowel('ㅑ')).toBe('ㅏ'));
  it('ㅕ → ㅓ', () => expect(getBaseVowel('ㅕ')).toBe('ㅓ'));
  it('ㅛ → ㅗ', () => expect(getBaseVowel('ㅛ')).toBe('ㅗ'));
  it('ㅠ → ㅜ', () => expect(getBaseVowel('ㅠ')).toBe('ㅜ'));
  it('ㅘ → ㅏ', () => expect(getBaseVowel('ㅘ')).toBe('ㅏ'));
  it('ㅟ → ㅣ', () => expect(getBaseVowel('ㅟ')).toBe('ㅣ'));
  it('단모음 ㅏ → ㅏ (그대로)', () => expect(getBaseVowel('ㅏ')).toBe('ㅏ'));
});
