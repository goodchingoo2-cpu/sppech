import React from 'react';
import type { TongueModel, LipModel } from '../input/types.js';
import {
  TONGUE_PATHS,
  TONGUE_CREASE_PATHS,
  TONGUE_VISIBLE_OPENNESS,
} from './tongueShapes.js';
import { LIP_OPENNESS } from './lipShapes.js';

interface TongueShapeProps {
  model: TongueModel;
  weight: number;
  lipModel: LipModel;
  lipWeight: number;
  cx?: number;
  cy?: number;
}

/**
 * 사실적 혀 렌더러
 *
 * - 방사형 그라데이션: 중앙 밝은 분홍 → 가장자리 어두운 분홍
 * - 중앙 세로 홈(crease): 자연스러운 혀 질감 표현
 * - 입이 충분히 열릴 때만(openness ≥ TONGUE_VISIBLE_OPENNESS) 표시
 */
export const TongueShape: React.FC<TongueShapeProps> = ({
  model,
  weight,
  lipModel,
  lipWeight,
  cx = 0,
  cy = 0,
}) => {
  const lipOpenness = LIP_OPENNESS[lipModel] * lipWeight;

  if (lipOpenness < TONGUE_VISIBLE_OPENNESS) return null;

  const tonguePath = TONGUE_PATHS[model];
  const creasePath = TONGUE_CREASE_PATHS[model];
  const opacity = Math.min(lipOpenness * weight * 1.5, 0.95);

  return (
    <g transform={`translate(${cx}, ${cy})`} opacity={opacity}>
      <defs>
        {/* 혀 방사형 그라데이션: 중앙 밝고, 가장자리 어두움 */}
        <radialGradient id="tongueGrad" cx="42%" cy="35%" r="62%">
          <stop offset="0%"   stopColor="#f5a0a8" />
          <stop offset="50%"  stopColor="#e07080" />
          <stop offset="100%" stopColor="#b84860" />
        </radialGradient>
        {/* 혀 하이라이트 */}
        <radialGradient id="tongueHighlight" cx="42%" cy="30%" r="45%">
          <stop offset="0%"   stopColor="white" stopOpacity="0.3" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        {/* 혀 클리핑 */}
        <clipPath id="tongueClip">
          <path d={tonguePath} />
        </clipPath>
      </defs>

      {/* 혀 본체 */}
      <path
        d={tonguePath}
        fill="url(#tongueGrad)"
        stroke="#7a2838"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />

      {/* 혀 표면 하이라이트 */}
      <path
        d={tonguePath}
        fill="url(#tongueHighlight)"
        stroke="none"
      />

      {/* 중앙 세로 홈 (crease) */}
      <path
        d={creasePath}
        fill="none"
        stroke="#9a3848"
        strokeWidth={1.4}
        strokeLinecap="round"
        opacity={0.45}
      />
    </g>
  );
};
