/**
 * 한국어 발음 규칙 적용 (최소 세트).
 *
 * 입력: tokenize()가 만든 Token 스트림.
 * 출력: 같은 모양의 Token 스트림이지만, 두 음절 간 경계에서 아래 규칙이 적용된 형태.
 *
 * 적용 규칙 (우선순위 순):
 *   1. ㅎ 탈락: 받침 ㅎ/ㄶ/ㅀ + 초성 ㅇ  → 받침 제거 (좋아 → 조아)
 *   2. 연음: 받침 존재 + 초성 ㅇ          → 받침이 다음 음절 초성으로 이동 (밥을 → 바블)
 *                                            (겹받침일 경우 두 번째 자음만 이동)
 *   3. 비음화: 받침 ㄱㄷㅂ계열 + 초성 ㄴㅁ → 받침을 ㅇㄴㅁ으로 동화 (국물 → 궁물)
 *
 * 규칙은 "받침이 있고, 다음 토큰이 공백 없이 이어지는 한글 음절" 조건에서만 적용한다.
 */

import { type Token, type Syllable, isSyllable } from './jamo.js';

// 받침 대표음 그룹
const CODA_K = new Set(['ㄱ', 'ㄲ', 'ㅋ', 'ㄳ', 'ㄺ']);
const CODA_T = new Set(['ㄷ', 'ㅅ', 'ㅆ', 'ㅈ', 'ㅊ', 'ㅌ']);
const CODA_P = new Set(['ㅂ', 'ㅍ', 'ㅄ', 'ㄿ']);
const CODA_H = new Set(['ㅎ', 'ㄶ', 'ㅀ']);

// 겹받침 → [이동 가능한 단독 자음, 유지되는 받침]
// 뒤 음절 초성이 'ㅇ'일 때 연음에서 두 번째 자음을 옮기고 첫 번째는 남긴다.
const CLUSTER_SPLIT: Readonly<Record<string, [string, string]>> = {
  'ㄳ': ['ㄱ', 'ㅅ'],
  'ㄵ': ['ㄴ', 'ㅈ'],
  'ㄶ': ['ㄴ', 'ㅎ'],
  'ㄺ': ['ㄹ', 'ㄱ'],
  'ㄻ': ['ㄹ', 'ㅁ'],
  'ㄼ': ['ㄹ', 'ㅂ'],
  'ㄽ': ['ㄹ', 'ㅅ'],
  'ㄾ': ['ㄹ', 'ㅌ'],
  'ㄿ': ['ㄹ', 'ㅍ'],
  'ㅀ': ['ㄹ', 'ㅎ'],
  'ㅄ': ['ㅂ', 'ㅅ'],
};

function withCoda(s: Syllable, jong: string): Syllable {
  return { ...s, jong };
}

function withOnset(s: Syllable, cho: string): Syllable {
  return { ...s, cho };
}

function applyPairRule(a: Syllable, b: Syllable): [Syllable, Syllable] {
  // 1. ㅎ 탈락: 받침 ㅎ계열 + 초성 ㅇ
  if (CODA_H.has(a.jong) && b.cho === 'ㅇ') {
    if (a.jong === 'ㄶ') return [withCoda(a, 'ㄴ'), b];
    if (a.jong === 'ㅀ') return [withCoda(a, 'ㄹ'), b];
    return [withCoda(a, ''), b];
  }

  // 2. 연음: 받침 있음 + 초성 ㅇ
  if (a.jong !== '' && b.cho === 'ㅇ') {
    const split = CLUSTER_SPLIT[a.jong];
    if (split) {
      const [keep, move] = split;
      return [withCoda(a, keep), withOnset(b, move)];
    }
    // 단일 받침 'ㅇ'은 연음되지 않는다 (받침 ㅇ은 /ŋ/이라 초성으로 옮길 수 없음)
    if (a.jong === 'ㅇ') return [a, b];
    return [withCoda(a, ''), withOnset(b, a.jong)];
  }

  // 3. 비음화: 받침 파열음 + 초성 비음
  if (b.cho === 'ㄴ' || b.cho === 'ㅁ') {
    if (CODA_K.has(a.jong)) return [withCoda(a, 'ㅇ'), b];
    if (CODA_T.has(a.jong)) return [withCoda(a, 'ㄴ'), b];
    if (CODA_P.has(a.jong)) return [withCoda(a, 'ㅁ'), b];
  }

  return [a, b];
}

export function applyPronunciationRules(tokens: readonly Token[]): Token[] {
  const out: Token[] = tokens.map((t) => (isSyllable(t) ? { ...t } : { ...t }));

  for (let i = 0; i < out.length - 1; i++) {
    const a = out[i]!;
    const b = out[i + 1]!;
    if (!isSyllable(a) || !isSyllable(b)) continue;
    const [na, nb] = applyPairRule(a, b);
    out[i] = na;
    out[i + 1] = nb;
  }

  return out;
}
