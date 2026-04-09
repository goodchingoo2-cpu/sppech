import React from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import type { RemotionFrameData } from '../input/types.js';
import { LipShape } from './LipShape.js';
import { TongueShape } from './TongueShape.js';

// ── 클로즈업 SVG 상수 ──────────────────────────────────────────
const VIEW_W = 200;
const VIEW_H = 120;
const MOUTH_CX = 100;
const MOUTH_CY = 60;

// LipShape/TongueShape 좌표계(중심=0,0)를 2.5배 확대
const SCALE = 2.5;

// ── 컴포넌트 Props ──────────────────────────────────────────────
export interface MouthCloseupProps extends Record<string, unknown> {
  frameData: RemotionFrameData[];
}

// ── 메인 컴포넌트 ───────────────────────────────────────────────
export const MouthCloseup: React.FC<MouthCloseupProps> = ({ frameData }) => {
  const frame = useCurrentFrame();

  const current: RemotionFrameData = frameData[frame] ?? {
    frameIndex: frame,
    lipModel: 'L6',
    tongueModel: 'T6',
    lipWeight: 0,
    tongueWeight: 0,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a0505' }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* viewBox 경계 클리핑 */}
          <clipPath id="closeupBounds">
            <rect x={0} y={0} width={VIEW_W} height={VIEW_H} />
          </clipPath>
        </defs>

        <g clipPath="url(#closeupBounds)">
          {/* ── 혀 (입술 아래 레이어) ── */}
          {/* translate로 중심 이동 후 scale 적용 → 좌표계 2.5배 확대 */}
          <g transform={`translate(${MOUTH_CX}, ${MOUTH_CY + 4}) scale(${SCALE})`}>
            <TongueShape
              model={current.tongueModel}
              weight={current.tongueWeight}
              lipModel={current.lipModel}
              lipWeight={current.lipWeight}
              cx={0}
              cy={0}
            />
          </g>

          {/* ── 입술 ── */}
          <g transform={`translate(${MOUTH_CX}, ${MOUTH_CY}) scale(${SCALE})`}>
            <LipShape
              model={current.lipModel}
              weight={current.lipWeight}
              blendModel={current.blendModel}
              blendWeight={current.blendWeight}
              cx={0}
              cy={0}
            />
          </g>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
