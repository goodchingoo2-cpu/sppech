import React from 'react';
import { interpolate } from 'remotion';
import type { LipModel } from '../input/types.js';
import {
  LIP_UPPER_PATHS,
  LIP_LOWER_PATHS,
  LIP_OPENNESS,
} from './lipShapes.js';

interface LipShapeProps {
  model: LipModel;
  weight: number;
  blendModel?: LipModel;
  blendWeight?: number;
  cx?: number;
  cy?: number;
}

/**
 * 사실적 입술 렌더러
 *
 * 렌더 순서 (아래→위):
 *  1. 구강 내부 어두운 배경
 *  2. 치아 (openness > 0.28 일 때)
 *  3. 아랫입술 (그라데이션 + 하이라이트)
 *  4. 윗입술 (큐피드 활 형태, 그라데이션 + 하이라이트)
 *  5. 블렌딩 레이어
 */
export const LipShape: React.FC<LipShapeProps> = ({
  model,
  weight,
  blendModel,
  blendWeight = 0,
  cx = 0,
  cy = 0,
}) => {
  const openness = LIP_OPENNESS[model] * weight;
  const upperPath = LIP_UPPER_PATHS[model];
  const lowerPath = LIP_LOWER_PATHS[model];
  // 원순 모음 (ㅗ,ㅜ,w계열) — 더 짙고 어두운 그라데이션
  const isRounded = (model === 'L4' || model === 'L5' || model === 'L9');

  // 구강 내부 타원 크기
  const innerRx = interpolate(openness, [0, 1], [0, 40]);
  const innerRy = interpolate(openness, [0, 1], [0, 20]);

  // 윗니
  const showTeeth = openness > 0.12;
  const teethH = showTeeth
    ? interpolate(openness, [0.12, 1.0], [1, 18], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  // 아랫니
  const showLowerTeeth = openness > 0.35;
  const lowerTeethH = showLowerTeeth
    ? interpolate(openness, [0.35, 1.0], [1, 10], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  // 치아 너비 — 중앙 앞니가 더 넓고, 코너로 갈수록 좁아지는 자연스러운 비율
  const toothWidths = [7, 9, 11, 11, 9, 7];
  const toothGap = 1;
  const toothCount = toothWidths.length;
  const totalTeethW = toothWidths.reduce((a, b) => a + b, 0) + (toothCount - 1) * toothGap;
  const teethStartX = -totalTeethW / 2;

  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <defs>
        {/* 비원순 윗입술 그라데이션 */}
        <linearGradient id="lipUpperGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#8a2238" />
          <stop offset="35%"  stopColor="#d85070" />
          <stop offset="100%" stopColor="#c03058" />
        </linearGradient>
        {/* 원순 윗입술 그라데이션 — 더 짙고 어두운 붉은빛 */}
        <linearGradient id="lipUpperGradR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#6a1428" />
          <stop offset="35%"  stopColor="#b03050" />
          <stop offset="100%" stopColor="#922040" />
        </linearGradient>

        {/* 비원순 아랫입술 그라데이션 */}
        <linearGradient id="lipLowerGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#c03058" />
          <stop offset="40%"  stopColor="#f07292" />
          <stop offset="100%" stopColor="#8a2238" />
        </linearGradient>
        {/* 원순 아랫입술 그라데이션 */}
        <linearGradient id="lipLowerGradR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#922040" />
          <stop offset="40%"  stopColor="#d05070" />
          <stop offset="100%" stopColor="#6a1428" />
        </linearGradient>

        {/* 윗입술 클리핑 (하이라이트용) */}
        <clipPath id="upperLipClip">
          <path d={upperPath} />
        </clipPath>

        {/* 아랫입술 클리핑 (하이라이트용) */}
        <clipPath id="lowerLipClip">
          <path d={lowerPath} />
        </clipPath>

        {/* 치아 클리핑 */}
        <clipPath id="teethAreaClip">
          <ellipse rx={Math.max(innerRx - 1, 0)} ry={Math.max(innerRy + 5, 0)} cy={4} />
        </clipPath>
      </defs>

      {/* ── 1. 구강 내부 어두운 배경 ── */}
      {openness > 0.03 && (
        <ellipse
          rx={innerRx}
          ry={innerRy}
          cy={4}
          fill="#1a0508"
          opacity={Math.min(openness * 1.8, 1)}
        />
      )}

      {/* ── 2. 치아 ── */}
      {showTeeth && teethH > 0 && (
        <g clipPath="url(#teethAreaClip)">
          {/* 윗니 — 누적 x 위치, 치아별 너비 다름 */}
          {(() => {
            const elems: React.ReactNode[] = [];
            let xOff = teethStartX;
            for (let i = 0; i < toothCount; i++) {
              const w = toothWidths[i];
              elems.push(
                <rect key={`u${i}`} x={xOff} y={-3} width={w} height={teethH + 4}
                  rx={2} fill="#f5f3ef" stroke="#d8d0bc" strokeWidth={0.4} />
              );
              if (i < toothCount - 1) {
                elems.push(
                  <line key={`ul${i}`}
                    x1={xOff + w + toothGap / 2} y1={-1}
                    x2={xOff + w + toothGap / 2} y2={teethH + 2}
                    stroke="#b8b0a0" strokeWidth={0.5} opacity={0.5} />
                );
              }
              xOff += w + toothGap;
            }
            return elems;
          })()}
          {/* 윗니 하이라이트 */}
          <rect
            x={teethStartX + toothWidths[0]}
            y={-2}
            width={totalTeethW - toothWidths[0] * 1.5}
            height={Math.max(teethH * 0.4, 0)}
            rx={1}
            fill="white"
            opacity={0.5}
          />

          {/* 아랫니 — 누적 x 위치 */}
          {showLowerTeeth && lowerTeethH > 0 && (() => {
            const elems: React.ReactNode[] = [];
            let xOff = teethStartX;
            for (let i = 0; i < toothCount; i++) {
              const w = toothWidths[i];
              elems.push(
                <rect key={`l${i}`} x={xOff + 1} y={teethH + 2} width={w - 1} height={lowerTeethH + 2}
                  rx={2} fill="#ede9e3" stroke="#ccc4b0" strokeWidth={0.4} />
              );
              if (i < toothCount - 1) {
                elems.push(
                  <line key={`ll${i}`}
                    x1={xOff + w + toothGap / 2 + 1} y1={teethH + 3}
                    x2={xOff + w + toothGap / 2 + 1} y2={teethH + lowerTeethH + 3}
                    stroke="#b0a898" strokeWidth={0.5} opacity={0.5} />
                );
              }
              xOff += w + toothGap;
            }
            return elems;
          })()}
        </g>
      )}

      {/* ── 3. 아랫입술 — weight에 따라 세로 스케일 (접합부 y=2 기준) ── */}
      <g transform={`translate(0, 2) scale(1, ${Math.max(weight, 0.15)}) translate(0, -2)`}>
        <path
          d={lowerPath}
          fill={isRounded ? 'url(#lipLowerGradR)' : 'url(#lipLowerGrad)'}
          stroke="#2a0008"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        {/* 아랫입술 광택 하이라이트 */}
        <g clipPath="url(#lowerLipClip)">
          <ellipse
            cx={0}
            cy={interpolate(openness, [0, 1], [2, 14])}
            rx={interpolate(openness, [0, 1], [10, 20])}
            ry={interpolate(openness, [0, 1], [2, 6])}
            fill="white"
            opacity={0.3}
          />
        </g>
      </g>

      {/* ── 4. 윗입술 ── */}
      <path
        d={upperPath}
        fill={isRounded ? 'url(#lipUpperGradR)' : 'url(#lipUpperGrad)'}
        stroke="#2a0008"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {/* 윗입술 광택 하이라이트 — 좌우 피크 */}
      <g clipPath="url(#upperLipClip)">
        <ellipse
          cx={-13}
          cy={-13}
          rx={9}
          ry={3.5}
          fill="white"
          opacity={0.38}
          transform="rotate(-18, -13, -13)"
        />
        <ellipse
          cx={13}
          cy={-13}
          rx={9}
          ry={3.5}
          fill="white"
          opacity={0.38}
          transform="rotate(18, 13, -13)"
        />
        {/* 중앙 딥 위 작은 하이라이트 */}
        <ellipse
          cx={0}
          cy={-7}
          rx={5}
          ry={2}
          fill="white"
          opacity={0.28}
        />
      </g>

      {/* ── 5. 블렌딩 레이어 (규칙 9: 원순 블렌딩) ── */}
      {blendModel && blendWeight > 0 && (
        <g opacity={blendWeight * 0.45}>
          <path d={LIP_UPPER_PATHS[blendModel]} fill="url(#lipUpperGrad)" stroke="none" />
          <path d={LIP_LOWER_PATHS[blendModel]} fill="url(#lipLowerGrad)" stroke="none" />
        </g>
      )}
    </g>
  );
};
