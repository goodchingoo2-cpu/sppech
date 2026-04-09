import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
} from 'remotion';
import type { RemotionFrameData } from '../input/types.js';
import { LipShape } from './LipShape.js';
import { TongueShape } from './TongueShape.js';

// ── 얼굴 SVG 상수 ──────────────────────────────────────────
const FACE_W = 400;
const FACE_H = 500;
const FACE_CX = 200;
const FACE_CY = 220;
const FACE_RX = 130;
const FACE_RY = 160;

const EYE_L = { cx: 148, cy: 175, r: 22 };
const EYE_R = { cx: 252, cy: 175, r: 22 };
const PUPIL_R = 11;

const NOSE_CX = 200;
const NOSE_CY = 235;

const MOUTH_CX = 200;
const MOUTH_CY = 305;

// ── 컴포넌트 Props ──────────────────────────────────────────

export interface FaceAnimationProps extends Record<string, unknown> {
  /** buildFrameData() 결과 */
  frameData: RemotionFrameData[];
}

// ── 보조: 눈 깜빡임 주기 계산 ──────────────────────────────

function getBlinkScale(frame: number, fps: number): number {
  // 3초마다 한 번 깜빡임 (0.1초 지속)
  const blinkPeriod = 3 * fps;
  const blinkDuration = Math.round(0.1 * fps);
  const phase = frame % blinkPeriod;
  if (phase < blinkDuration) {
    return interpolate(phase, [0, blinkDuration / 2, blinkDuration], [1, 0.05, 1]);
  }
  return 1;
}

// ── 메인 컴포넌트 ───────────────────────────────────────────

export const FaceAnimation: React.FC<FaceAnimationProps> = ({ frameData }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 현재 프레임의 Viseme 데이터 조회
  const current: RemotionFrameData = frameData[frame] ?? {
    frameIndex: frame,
    lipModel: 'L6',
    tongueModel: 'T6',
    lipWeight: 0,
    tongueWeight: 0,
  };

  const blinkScale = getBlinkScale(frame, fps);

  return (
    <AbsoluteFill style={{ backgroundColor: '#f8f0e8' }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${FACE_W} ${FACE_H}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* ── 피부 그라데이션 정의 ── */}
        <defs>
          <radialGradient id="faceGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%"   stopColor="#fde8d0" />
            <stop offset="100%" stopColor="#e8c4a0" />
          </radialGradient>
          <radialGradient id="eyeGrad" cx="40%" cy="35%" r="60%">
            <stop offset="0%"   stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e8e8e8" />
          </radialGradient>
        </defs>

        {/* ── 얼굴 외형 ── */}
        <ellipse
          cx={FACE_CX} cy={FACE_CY}
          rx={FACE_RX} ry={FACE_RY}
          fill="url(#faceGrad)"
          stroke="#c8a080"
          strokeWidth={2}
        />

        {/* ── 귀 ── */}
        <ellipse cx={FACE_CX - FACE_RX + 4} cy={FACE_CY + 10} rx={14} ry={22}
          fill="#e8c4a0" stroke="#c8a080" strokeWidth={1.5} />
        <ellipse cx={FACE_CX + FACE_RX - 4} cy={FACE_CY + 10} rx={14} ry={22}
          fill="#e8c4a0" stroke="#c8a080" strokeWidth={1.5} />

        {/* ── 눈썹 ── */}
        <path d={`M ${EYE_L.cx - 20},${EYE_L.cy - 28} Q ${EYE_L.cx},${EYE_L.cy - 33} ${EYE_L.cx + 20},${EYE_L.cy - 28}`}
          fill="none" stroke="#6b4c2a" strokeWidth={3} strokeLinecap="round" />
        <path d={`M ${EYE_R.cx - 20},${EYE_R.cy - 28} Q ${EYE_R.cx},${EYE_R.cy - 33} ${EYE_R.cx + 20},${EYE_R.cy - 28}`}
          fill="none" stroke="#6b4c2a" strokeWidth={3} strokeLinecap="round" />

        {/* ── 눈 (흰자) ── */}
        <ellipse cx={EYE_L.cx} cy={EYE_L.cy} rx={EYE_L.r} ry={EYE_L.r * blinkScale}
          fill="url(#eyeGrad)" stroke="#8b7060" strokeWidth={1.5} />
        <ellipse cx={EYE_R.cx} cy={EYE_R.cy} rx={EYE_R.r} ry={EYE_R.r * blinkScale}
          fill="url(#eyeGrad)" stroke="#8b7060" strokeWidth={1.5} />

        {/* ── 눈동자 ── */}
        {blinkScale > 0.3 && (
          <>
            <circle cx={EYE_L.cx + 2} cy={EYE_L.cy + 2} r={PUPIL_R} fill="#3a2010" />
            <circle cx={EYE_R.cx + 2} cy={EYE_R.cy + 2} r={PUPIL_R} fill="#3a2010" />
            {/* 눈 하이라이트 */}
            <circle cx={EYE_L.cx - 4} cy={EYE_L.cy - 4} r={3.5} fill="white" opacity={0.8} />
            <circle cx={EYE_R.cx - 4} cy={EYE_R.cy - 4} r={3.5} fill="white" opacity={0.8} />
          </>
        )}

        {/* ── 코 ── */}
        <ellipse cx={NOSE_CX - 8} cy={NOSE_CY + 8} rx={4} ry={3}
          fill="#c8a080" opacity={0.6} />
        <ellipse cx={NOSE_CX + 8} cy={NOSE_CY + 8} rx={4} ry={3}
          fill="#c8a080" opacity={0.6} />
        <path d={`M ${NOSE_CX - 6},${NOSE_CY - 8} C ${NOSE_CX - 8},${NOSE_CY} ${NOSE_CX - 10},${NOSE_CY + 6} ${NOSE_CX - 8},${NOSE_CY + 10}`}
          fill="none" stroke="#c09070" strokeWidth={1.5} />
        <path d={`M ${NOSE_CX + 6},${NOSE_CY - 8} C ${NOSE_CX + 8},${NOSE_CY} ${NOSE_CX + 10},${NOSE_CY + 6} ${NOSE_CX + 8},${NOSE_CY + 10}`}
          fill="none" stroke="#c09070" strokeWidth={1.5} />

        {/* ── 입 영역 — 클리핑 마스크 (혀/치아용, 아랫입술보다 크게) ── */}
        <clipPath id="mouthClip">
          <ellipse cx={MOUTH_CX} cy={MOUTH_CY + 6} rx={46} ry={32} />
        </clipPath>

        {/* ── 혀 (입 내부에 클리핑) ── */}
        <g clipPath="url(#mouthClip)">
          <TongueShape
            model={current.tongueModel}
            weight={current.tongueWeight}
            lipModel={current.lipModel}
            lipWeight={current.lipWeight}
            cx={MOUTH_CX}
            cy={MOUTH_CY + 4}
          />
        </g>

        {/* ── 입술 ── */}
        <LipShape
          model={current.lipModel}
          weight={current.lipWeight}
          blendModel={current.blendModel}
          blendWeight={current.blendWeight}
          cx={MOUTH_CX}
          cy={MOUTH_CY}
        />

        {/* ── 볼 홍조 ── */}
        <ellipse cx={FACE_CX - 75} cy={FACE_CY + 55} rx={28} ry={18}
          fill="#f0a0a0" opacity={0.25} />
        <ellipse cx={FACE_CX + 75} cy={FACE_CY + 55} rx={28} ry={18}
          fill="#f0a0a0" opacity={0.25} />
      </svg>
    </AbsoluteFill>
  );
};
