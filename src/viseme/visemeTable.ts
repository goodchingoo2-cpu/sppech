// ============================================================
// Viseme 매핑 테이블 (가이드 §1.1, §1.2 기반)
// 자음 → 혀 모델, 모음 → 입술/혀 모델 정적 매핑
// ============================================================

import type { LipModel, ConsonantTongueModel, VowelTongueModel } from '../input/types.js';
import { isDiphthong, getBaseVowel } from '../korean/hangulDecomposer.js';

// ── 자음 집합 상수 ──────────────────────────────────────────

/** 양순음: 발화 시 입술이 완전히 닫힘 (규칙 7: lipWeight=1.0, L9) */
export const BILABIALS = new Set(['ㅁ', 'ㅂ', 'ㅃ', 'ㅍ']);

/** 치경음: 조음 시 입 크기 임계값 적용 (규칙 8) */
export const ALVEOLARS = new Set(['ㄴ', 'ㄷ', 'ㄸ', 'ㅅ', 'ㅆ', 'ㅈ']);

/** 원순 모음: 양순음 인접 시 0.4 블렌딩 (규칙 9) */
export const ROUND_VOWELS = new Set(['ㅗ', 'ㅜ', 'ㅛ', 'ㅠ', 'ㅘ', 'ㅚ', 'ㅝ', 'ㅞ', 'ㅟ']);

/** T5 예외 모델 적용 트리거 모음 (치경음이 이 모음 앞에 올 때) */
export const T5_TRIGGER_VOWELS = new Set(['ㅑ', 'ㅟ', 'ㅣ', 'ㅒ', 'ㅖ']);

// ── 자음 → 혀 모델 ─────────────────────────────────────────
// T5는 문맥 의존적이므로 requiresT5() 함수로 별도 처리

export const CONSONANT_TONGUE_MAP: Record<string, ConsonantTongueModel> = {
  // T1: 치경음
  'ㄴ': 'T1', 'ㄷ': 'T1', 'ㄸ': 'T1', 'ㅌ': 'T1',
  'ㄹ': 'T1', 'ㅅ': 'T1', 'ㅆ': 'T1',
  // T2: 치경경구개음
  'ㅈ': 'T2', 'ㅉ': 'T2', 'ㅊ': 'T2',
  // T3: 연구개음
  'ㄱ': 'T3', 'ㄲ': 'T3', 'ㅋ': 'T3',
  // T4: 양순음 (입술은 L9, 규칙 7에서 처리)
  'ㅁ': 'T4', 'ㅂ': 'T4', 'ㅃ': 'T4', 'ㅍ': 'T4',
  // T6: 초성 ㅇ (음가 없음)
  'ㅇ': 'T6',
  // T7: 초성 ㅎ (후행 모음의 영향 받음)
  'ㅎ': 'T7',
};

// ── 모음 → 입술 모델 ───────────────────────────────────────

export const VOWEL_LIP_MAP: Record<string, LipModel> = {
  // 단모음 7종 (L1~L7)
  'ㅏ': 'L1',
  'ㅐ': 'L2', 'ㅔ': 'L2',
  'ㅓ': 'L3',
  'ㅗ': 'L4',
  'ㅜ': 'L5',
  'ㅡ': 'L6',
  'ㅣ': 'L7',
  // 반모음용 (L8: j계열, L9: w계열/양순음)
  // 이중모음은 getVowelLip()에서 기저 단모음으로 매핑
};

// ── 모음 → 혀 모델 ─────────────────────────────────────────
// 혀 높낮이/전후 위치 기준

export const VOWEL_TONGUE_MAP: Record<string, VowelTongueModel> = {
  // VT1: 고모음 전설 (입천장 높이 가까운 앞쪽)
  'ㅣ': 'VT1', 'ㅐ': 'VT1', 'ㅔ': 'VT1',
  // VT2: 저모음 중설
  'ㅏ': 'VT2',
  // VT3: 중모음 후설
  'ㅓ': 'VT3', 'ㅡ': 'VT3',
  // VT4: 고모음 후설 원순
  'ㅗ': 'VT4', 'ㅜ': 'VT4',
  // VT5: 중간 위치 (이중모음 기저음 적용, 아래 함수에서 위임)
};

// ── 공개 함수 ──────────────────────────────────────────────

/**
 * 자음에 T5 예외 모델을 적용해야 하는지 판별
 *
 * T5는 치경음/치경경구개음이 특정 전설 고모음 앞에 올 때 적용
 * (가이드 §1.1 T5 항목)
 */
export function requiresT5(consonant: string, nextVowel: string): boolean {
  const isAlveolarOrPostAlveolar =
    ALVEOLARS.has(consonant) || consonant === 'ㅈ' || consonant === 'ㅉ' || consonant === 'ㅊ';
  return isAlveolarOrPostAlveolar && T5_TRIGGER_VOWELS.has(nextVowel);
}

/**
 * 자음의 혀 모델 반환 (nextVowel이 있으면 T5 예외 체크)
 */
export function getConsonantTongue(
  consonant: string,
  nextVowel?: string
): ConsonantTongueModel {
  if (nextVowel && requiresT5(consonant, nextVowel)) {
    return 'T5';
  }
  return CONSONANT_TONGUE_MAP[consonant] ?? 'T1';
}

/**
 * 모음의 입술 모델 반환
 * - 이중모음은 기저 단모음으로 매핑
 * - j계열 반모음 타임슬롯에는 L8, w계열에는 L9
 */
export function getVowelLip(vowel: string, semivowelPart = false): LipModel {
  if (semivowelPart) {
    const type = getSemivowelTypeLocal(vowel);
    return type === 'w' ? 'L9' : 'L8';
  }
  const base = isDiphthong(vowel) ? getBaseVowel(vowel) : vowel;
  return VOWEL_LIP_MAP[base] ?? 'L1';
}

/**
 * 모음의 혀 모델 반환
 * - 이중모음은 기저 단모음으로 매핑
 * - VOWEL_TONGUE_MAP에 없으면 VT5(중간값)
 */
export function getVowelTongue(vowel: string): VowelTongueModel {
  const base = isDiphthong(vowel) ? getBaseVowel(vowel) : vowel;
  return VOWEL_TONGUE_MAP[base] ?? 'VT5';
}

// 내부 헬퍼 (hangulDecomposer의 getSemivowelType 재활용 없이 독립 처리)
function getSemivowelTypeLocal(vowel: string): 'j' | 'w' | null {
  const W = new Set(['ㅘ', 'ㅙ', 'ㅚ', 'ㅝ', 'ㅞ', 'ㅟ']);
  const J = new Set(['ㅑ', 'ㅒ', 'ㅕ', 'ㅖ', 'ㅛ', 'ㅠ', 'ㅢ']);
  if (W.has(vowel)) return 'w';
  if (J.has(vowel)) return 'j';
  return null;
}
