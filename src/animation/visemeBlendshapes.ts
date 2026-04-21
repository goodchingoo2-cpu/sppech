/**
 * 비즈메(viseme) → ARKit 블렌드셰이프 가중치 매핑.
 *
 * Ready Player Me GLB는 ARKit 52개 블렌드셰이프를 표준 이름으로 노출한다.
 * (morphTargets=ARKit 쿼리 파라미터로 요청 시)
 *
 * 비즈메 하나는 여러 블렌드셰이프의 조합으로 표현된다.
 * 값 범위: 0.0 ~ 1.0 (음수 허용 X).
 *
 * 모델을 바꿔도 (Didimo / VRM 등) 이 파일의 블렌드셰이프 이름만 교체하면 된다.
 */

import type { Viseme } from '../viseme/visemeMap.js';

/** ARKit 블렌드셰이프 이름 → 가중치. */
export type BlendshapeWeights = Readonly<Record<string, number>>;

const NEUTRAL: BlendshapeWeights = {};

export const VISEME_TO_BLENDSHAPES: Readonly<Record<Viseme, BlendshapeWeights>> = {
  // 아 계열 - 큰 개구, 턱 내림
  V_A: {
    jawOpen: 0.55,
    mouthStretchLeft: 0.20,
    mouthStretchRight: 0.20,
  },
  // 어/으 - 중간 개구, 평순
  V_EO: {
    jawOpen: 0.35,
    mouthStretchLeft: 0.12,
    mouthStretchRight: 0.12,
  },
  // 오/우 - 원순
  V_O: {
    jawOpen: 0.25,
    mouthFunnel: 0.65,
    mouthPucker: 0.45,
  },
  // 이/에/애 - 좁은 개구 + 입꼬리 양옆
  V_I: {
    jawOpen: 0.12,
    mouthSmileLeft: 0.28,
    mouthSmileRight: 0.28,
    mouthStretchLeft: 0.35,
    mouthStretchRight: 0.35,
  },
  // ㅁㅂㅍ - 양순 폐구
  V_M: {
    mouthClose: 0.85,
    mouthPressLeft: 0.30,
    mouthPressRight: 0.30,
  },
  // ㄴㄷㅌㄹ - 혀끝 상승, 개구 작음
  V_N: {
    jawOpen: 0.18,
    mouthShrugUpper: 0.18,
    tongueOut: 0.08,
  },
  // ㄱㅋㅎ - 연구개
  V_K: {
    jawOpen: 0.28,
    mouthShrugLower: 0.10,
  },
  // ㅅㅈㅊ - 치찰, 치 약간 노출
  V_S: {
    jawOpen: 0.18,
    mouthStretchLeft: 0.22,
    mouthStretchRight: 0.22,
    tongueOut: 0.04,
  },
  // 받침 ㅇ - 구강 유지, 비음
  V_NG: {
    jawOpen: 0.15,
  },
  // 긴 침묵
  V_SIL: NEUTRAL,
  // 기본 휴지 (살짝 닫힘)
  V_REST: NEUTRAL,
};

/**
 * 이 파이프라인이 사용하는 모든 블렌드셰이프 이름의 유니크 집합.
 * MorphController가 타겟 0으로 리셋할 때 사용.
 */
export const USED_BLENDSHAPE_NAMES: readonly string[] = Array.from(
  new Set(
    Object.values(VISEME_TO_BLENDSHAPES).flatMap((w) => Object.keys(w)),
  ),
);
