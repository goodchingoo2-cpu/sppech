// ============================================================
// Viseme 매핑 오케스트레이터
// G2P 완료된 PhonemeToken[] → VisemeFrame[] 파이프라인
//
// 처리 순서:
//   1. 운율 가중치 계산 (prosodicWeight)
//   2. 동시조음 규칙 적용 (coarticulation, 규칙 5~12)
//   3. 자음 구간 입술 스플라인 보간 (splineInterpolator)
// ============================================================

import type { PhonemeToken, VisemeFrame } from '../input/types.js';
import { calculatePhraseWeights } from './prosodicWeight.js';
import { applyCoarticulation } from './coarticulation.js';
import { fillConsonantLips } from './splineInterpolator.js';

export interface VisemeMapperOptions {
  /** 음운구 경계 pause 임계값 (기본 0.4초) */
  pauseThreshold?: number;
}

/**
 * G2P 완료된 PhonemeToken[] → VisemeFrame[]
 *
 * @param tokens  G2P 규칙 적용이 끝난 토큰 배열 (intensity 포함)
 * @param options 옵션
 * @returns       최종 VisemeFrame[] (입술 모델 완전 채워진 상태)
 */
export function mapToVisemes(
  tokens: PhonemeToken[],
  options: VisemeMapperOptions = {}
): VisemeFrame[] {
  // Step 1: 운율 가중치
  const weights = calculatePhraseWeights(tokens);

  // Step 2: 동시조음 규칙 5~12 → VisemeFrame[]
  const rawFrames = applyCoarticulation(tokens, weights);

  // Step 3: 자음 구간 입술 스플라인 보간
  return fillConsonantLips(rawFrames);
}
