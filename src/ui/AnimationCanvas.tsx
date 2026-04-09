// ============================================================
// AnimationCanvas — 검정 배경 위 입술만 렌더링 (얼굴 없음)
// LipShape / TongueShape 컴포넌트 직접 사용
// ============================================================

import React from 'react';
import type { RemotionFrameData, LipModel, TongueModel } from '../input/types.js';
import { LipShape } from '../animation/LipShape.js';
import { TongueShape } from '../animation/TongueShape.js';
import { LIP_OPENNESS } from '../animation/lipShapes.js';

interface Props {
  frame: RemotionFrameData | null;
  size?: number;
}

const NEUTRAL_LIP: LipModel  = 'L6';
const NEUTRAL_TONGUE: TongueModel = 'T6';

// 입술 영역만 꽉 차도록 viewBox 설정
// x: ±52  y: -28 ~ +32  → 104 × 60
const VB_X = -52;
const VB_Y = -28;
const VB_W = 104;
const VB_H = 64;

export function AnimationCanvas({ frame, size = 360 }: Props) {
  const lipModel    = frame?.lipModel    ?? NEUTRAL_LIP;
  const tongueModel = frame?.tongueModel ?? NEUTRAL_TONGUE;
  const lipWeight   = frame?.lipWeight   ?? 0;
  const tongueWeight = frame?.tongueWeight ?? 0;
  const blendModel  = frame?.blendModel;
  const blendWeight = frame?.blendWeight ?? 0;
  const morphTarget = frame?.morphTarget;
  const morphT      = frame?.morphT ?? 0;

  // 구강 클리핑 타원 — openness에 따라 ry 동적 조정
  const openness = LIP_OPENNESS[lipModel] * lipWeight;
  const clipRy = Math.max(4, 4 + 14 * openness); // 닫힘:4 ~ 최대개구:18
  // 혀 세로 위치 — 입이 열릴수록 혀가 아래로 (턱이 내려가는 효과)
  const tongueCy = 2 + openness * 6; // 최소개구:2 ~ 최대개구:8

  const height = Math.round(size * (VB_H / VB_W));

  return (
    <svg
      width={size}
      height={height}
      viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}
      style={{ display: 'block', background: '#000', borderRadius: 14 }}
      aria-label="입술 애니메이션"
    >
      <defs>
        {/* 배경: 순수 검정 + 중앙 미묘한 붉은 글로우 */}
        <radialGradient id="bgGlow" cx="50%" cy="65%" r="60%">
          <stop offset="0%"   stopColor="#1e060a" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>

        {/* 혀 클리핑: 입술 안쪽 타원 — 아랫입술 밖으로 나오지 않도록 타이트하게 */}
        <clipPath id="mouthAreaClip">
          <ellipse cx={0} cy={4} rx={42} ry={clipRy} />
        </clipPath>
      </defs>

      {/* 배경 */}
      <rect
        x={VB_X} y={VB_Y}
        width={VB_W} height={VB_H}
        fill="url(#bgGlow)"
      />

      {/* 입술 + 혀 그룹 */}
      <g>
        {/* 혀 (입술보다 먼저 렌더링, 클리핑 적용) */}
        <g clipPath="url(#mouthAreaClip)">
          <TongueShape
            model={tongueModel}
            weight={tongueWeight}
            lipModel={lipModel}
            lipWeight={lipWeight}
            cx={0}
            cy={tongueCy}
          />
        </g>

        {/* 입술 */}
        <LipShape
          model={lipModel}
          weight={lipWeight}
          blendModel={blendModel}
          blendWeight={blendWeight}
          morphTarget={morphTarget}
          morphT={morphT}
          cx={0}
          cy={0}
        />
      </g>
    </svg>
  );
}
