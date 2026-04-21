/**
 * 한국어 특화 비즈메(viseme) 세트.
 *
 * 총 11개.
 *   V_A    : 아 계열 모음 - 큰 개구
 *   V_EO   : 어/으 계열 - 중간 개구, 평순
 *   V_O    : 오/우 계열 - 원순
 *   V_I    : 이/에/애 계열 - 좁은 개구, 입꼬리 양옆
 *   V_M    : 양순 폐구 (ㅁㅂㅍ)
 *   V_N    : 치경 (ㄴㄷㅌㄹ) - 혀끝 상승, 개구 작음
 *   V_K    : 연구개 (ㄱㅋㅎ) - 개구 중간, 혀 뒤 상승
 *   V_S    : 치찰 (ㅅㅈㅊ) - 개구 작음, 치 노출
 *   V_NG   : 받침 ㅇ - 구강 유지, 연구개 상승
 *   V_SIL  : 긴 침묵 (문장 간 공백)
 *   V_REST : 기본 휴지 상태 (살짝 닫힘)
 *
 * 이후 Phase 2에서 각 비즈메를 ARKit 블렌드셰이프 조합으로 매핑한다.
 *
 * 활음(WA, WEO, UI)은 두 모음 비즈메의 연속으로 펼쳐진다 (expandVowelPhoneme 참고).
 */

import { type Phoneme, type VowelPhoneme, type ConsonantPhoneme } from '../korean/phoneme.js';

export type Viseme =
  | 'V_A'
  | 'V_EO'
  | 'V_O'
  | 'V_I'
  | 'V_M'
  | 'V_N'
  | 'V_K'
  | 'V_S'
  | 'V_NG'
  | 'V_SIL'
  | 'V_REST';

const CONSONANT_MAP: Readonly<Record<ConsonantPhoneme, Viseme>> = {
  M: 'V_M',
  N: 'V_N',
  K: 'V_K',
  S: 'V_S',
  NG: 'V_NG',
  _: 'V_REST', // 초성 ㅇ은 음가 없음 → 바로 다음 모음으로 진행하므로 휴지
};

const SIMPLE_VOWEL_MAP: Readonly<Record<'A' | 'EO' | 'O' | 'I', Viseme>> = {
  A: 'V_A',
  EO: 'V_EO',
  O: 'V_O',
  I: 'V_I',
};

/**
 * 단일 모음 음소 → 비즈메 시퀀스.
 * 활음(WA, WEO, UI)은 두 비즈메 연속으로 확장.
 */
export function expandVowelPhoneme(v: VowelPhoneme): Viseme[] {
  switch (v) {
    case 'A':   return ['V_A'];
    case 'EO':  return ['V_EO'];
    case 'O':   return ['V_O'];
    case 'I':   return ['V_I'];
    case 'WA':  return ['V_O', 'V_A'];  // 오→아 활음
    case 'WEO': return ['V_O', 'V_EO']; // 우→어 활음
    case 'UI':  return ['V_EO', 'V_I']; // 으→이 활음
  }
}

export function consonantToViseme(c: ConsonantPhoneme): Viseme {
  return CONSONANT_MAP[c];
}

export function phonemeToVisemes(p: Phoneme): Viseme[] {
  if (p === 'A' || p === 'EO' || p === 'O' || p === 'I') return [SIMPLE_VOWEL_MAP[p]];
  if (p === 'WA' || p === 'WEO' || p === 'UI') return expandVowelPhoneme(p);
  return [CONSONANT_MAP[p]];
}
