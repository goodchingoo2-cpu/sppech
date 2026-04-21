import { describe, it, expect } from 'vitest';
import {
  decomposeSyllable,
  composeSyllable,
  isHangulSyllable,
  tokenize,
  isSyllable,
} from '../../src/korean/jamo.js';

describe('jamo.decomposeSyllable', () => {
  it('가 = ㄱ + ㅏ + (없음)', () => {
    expect(decomposeSyllable('가')).toEqual({ char: '가', cho: 'ㄱ', jung: 'ㅏ', jong: '' });
  });

  it('안 = ㅇ + ㅏ + ㄴ', () => {
    expect(decomposeSyllable('안')).toEqual({ char: '안', cho: 'ㅇ', jung: 'ㅏ', jong: 'ㄴ' });
  });

  it('값 = ㄱ + ㅏ + ㅄ (겹받침)', () => {
    expect(decomposeSyllable('값')).toEqual({ char: '값', cho: 'ㄱ', jung: 'ㅏ', jong: 'ㅄ' });
  });

  it('뷁 = ㅂ + ㅞ + ㄺ', () => {
    expect(decomposeSyllable('뷁')).toEqual({ char: '뷁', cho: 'ㅂ', jung: 'ㅞ', jong: 'ㄺ' });
  });

  it('힣 (마지막 음절)', () => {
    expect(decomposeSyllable('힣')).toEqual({ char: '힣', cho: 'ㅎ', jung: 'ㅣ', jong: 'ㅎ' });
  });

  it('한글 아닌 문자는 예외', () => {
    expect(() => decomposeSyllable('A')).toThrow();
    expect(() => decomposeSyllable('ㄱ')).toThrow(); // 자모 단독은 음절이 아님
  });
});

describe('jamo.composeSyllable (역연산)', () => {
  it.each(['가', '안', '한', '글', '값', '힣'])('%s 는 분해→조합해도 동일', (ch) => {
    const d = decomposeSyllable(ch);
    expect(composeSyllable(d.cho, d.jung, d.jong)).toBe(ch);
  });
});

describe('jamo.isHangulSyllable', () => {
  it.each([
    ['가', true], ['힣', true], ['안', true],
    ['A', false], [' ', false], ['ㄱ', false], ['1', false],
  ])('%s → %s', (ch, expected) => {
    expect(isHangulSyllable(ch)).toBe(expected);
  });
});

describe('jamo.tokenize', () => {
  it('"안녕" → 두 음절', () => {
    const toks = tokenize('안녕');
    expect(toks).toHaveLength(2);
    expect(toks.every(isSyllable)).toBe(true);
  });

  it('공백과 문장부호를 구분', () => {
    const toks = tokenize('안녕, 반가워!');
    const kinds = toks.map((t) => (isSyllable(t) ? 'S' : t.kind));
    expect(kinds).toEqual(['S', 'S', 'punct', 'space', 'S', 'S', 'S', 'punct']);
  });
});
