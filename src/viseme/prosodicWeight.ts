// ============================================================
// 운율 가중치 계산 (가이드 §3)
// w_t = a(1 - e^(-c * i_t)) / ((1 / d_t) + a)
// a=20, c=0.02
// ============================================================

import { clamp } from '../utils/mathUtils.js';
import type { PhonemeToken } from '../input/types.js';

export const PROSODIC_A = 20;
export const PROSODIC_C = 0.02;

/** 논문식 원본 공식 결과 (0~1 범위) */
export function rawProsodicWeight(intensity: number, duration: number): number {
  const d = Math.max(duration, 0.001);
  const numerator = PROSODIC_A * (1 - Math.exp(-PROSODIC_C * Math.max(intensity, 0)));
  const denominator = (1 / d) + PROSODIC_A;
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * 음운구 내 모음 토큰들의 운율 가중치를 계산
 *
 * 처리 순서:
 *  1. 각 모음에 대해 rawProsodicWeight 계산
 *  2. 수치 안정성을 위해 [0, 1] 범위로만 클램핑
 *
 * @param tokens G2P 규칙 적용 완료된 PhonemeToken[]
 * @returns 각 token에 대응하는 가중치 (모음=계산값, 자음/pause=0)
 */
export function calculatePhraseWeights(tokens: PhonemeToken[]): number[] {
  return tokens.map((t) => {
    if (!t.isVowel || t.isPause) return 0;
    return clamp(rawProsodicWeight(t.intensity, t.duration), 0, 1);
  });
}
