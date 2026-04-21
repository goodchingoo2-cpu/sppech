/**
 * 얼굴 표정 프리셋.
 * 각 프리셋은 ARKit 블렌드셰이프 가중치 조합이다.
 * MorphController의 'expression' 레이어에 주입한다.
 */

import type { BlendshapeWeights } from './visemeBlendshapes.js';

export type ExpressionName = 'neutral' | 'smile' | 'encouraging' | 'surprised' | 'thinking';

export const EXPRESSION_PRESETS: Readonly<Record<ExpressionName, BlendshapeWeights>> = {
  neutral: {},

  // 기본 미소 - 튜터의 친근한 기본 상태
  smile: {
    mouthSmileLeft: 0.25,
    mouthSmileRight: 0.25,
    cheekSquintLeft: 0.10,
    cheekSquintRight: 0.10,
  },

  // 격려 - 눈썹 살짝 올리고 미소
  encouraging: {
    browOuterUpLeft: 0.30,
    browOuterUpRight: 0.30,
    mouthSmileLeft: 0.35,
    mouthSmileRight: 0.35,
    cheekSquintLeft: 0.15,
    cheekSquintRight: 0.15,
  },

  // 놀람
  surprised: {
    eyeWideLeft: 0.50,
    eyeWideRight: 0.50,
    browInnerUp: 0.60,
    browOuterUpLeft: 0.40,
    browOuterUpRight: 0.40,
    jawOpen: 0.20,
  },

  // 생각 - 살짝 한쪽 눈썹 올림 + 입 오물
  thinking: {
    browDownLeft: 0.20,
    browOuterUpRight: 0.15,
    mouthPressLeft: 0.20,
  },
};

/** expression 레이어에 등록할 이름들 (MorphController가 관리 대상에 추가하도록). */
export const EXPRESSION_BLENDSHAPE_NAMES: readonly string[] = Array.from(
  new Set(
    Object.values(EXPRESSION_PRESETS).flatMap((w) => Object.keys(w)),
  ),
);
