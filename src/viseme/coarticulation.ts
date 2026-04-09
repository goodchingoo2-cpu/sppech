// ============================================================
// 동시조음(Co-articulation) 규칙 엔진 (가이드 §2.2, 규칙 5~12)
//
// 규칙 5:  모음 타이밍 → 입술 + 혀 모델 매핑
// 규칙 6:  자음 타이밍 → 혀만 매핑, 입술은 스플라인 보간(null)
// 규칙 7:  양순음(ㅁ,ㅂ,ㅃ,ㅍ) → lipModel=L9, lipWeight=1.0
// 규칙 8:  치경음 임계값 → 특정 모음 인접 시 lipWeight ≤ 0.6
// 규칙 9:  원순 모음 + 양순음 인접 → 가중치 0.4 블렌딩
// 규칙 10: 이중모음 타이밍 → 반모음 지속시간 = 전체 × 0.5
// 규칙 11: 이중모음 가중치 → α=0.4, β=0.1 블렌딩
// 규칙 12: 쉼 < 0.4초 → 프레임 생략
// ============================================================

import type {
  PhonemeToken,
  VisemeFrame,
  LipModel,
  TongueModel,
  BlendTarget,
} from '../input/types.js';
import {
  BILABIALS,
  ALVEOLARS,
  ROUND_VOWELS,
  getConsonantTongue,
  getVowelLip,
  getVowelTongue,
} from './visemeTable.js';
import { calculatePhraseWeights } from './prosodicWeight.js';
import { getSemivowelType, getBaseVowel } from '../korean/hangulDecomposer.js';
import { clamp } from '../utils/mathUtils.js';

/** 규칙 12: 짧은 쉼 임계값 (초) */
export const SHORT_PAUSE_THRESHOLD = 0.4;

/** 규칙 8: 치경음 앞 모음 최대 lipWeight 임계값 */
const ALVEOLAR_LIP_MAX = 0.6;

/** 규칙 9: 원순 블렌딩 가중치 */
const ROUND_BLEND_WEIGHT = 0.4;

/** 규칙 11: 이중모음 반모음 블렌딩 상수 */
const DIPHTHONG_ALPHA = 0.4;
const DIPHTHONG_BETA = 0.1;

// ── 내부 헬퍼 ──────────────────────────────────────────────

/** 인접 토큰 중 가장 가까운 모음 찾기 (방향: -1=이전, 1=이후) */
function findNearestVowel(
  tokens: PhonemeToken[],
  from: number,
  direction: -1 | 1
): PhonemeToken | null {
  let i = from + direction;
  while (i >= 0 && i < tokens.length) {
    const t = tokens[i];
    if (!t.isPause && t.isVowel) return t;
    if (t.isPause && t.duration >= SHORT_PAUSE_THRESHOLD) return null; // 음운구 경계
    i += direction;
  }
  return null;
}

/** 인접 토큰 중 가장 가까운 자음 찾기 */
function findNearestConsonant(
  tokens: PhonemeToken[],
  from: number,
  direction: -1 | 1
): PhonemeToken | null {
  let i = from + direction;
  while (i >= 0 && i < tokens.length) {
    const t = tokens[i];
    if (!t.isPause && !t.isVowel) return t;
    if (t.isPause && t.duration >= SHORT_PAUSE_THRESHOLD) return null;
    i += direction;
  }
  return null;
}

// ── 규칙 5: 모음 프레임 생성 ───────────────────────────────

function makeVowelFrame(
  token: PhonemeToken,
  lipWeight: number
): VisemeFrame {
  return {
    timeStart: token.start,
    timeEnd: token.end,
    lipModel: getVowelLip(token.jamo),
    tongueModel: getVowelTongue(token.jamo),
    lipWeight,
    tongueWeight: lipWeight,
  };
}

// ── 규칙 6: 자음 프레임 생성 (입술은 null → 스플라인 보간) ─

function makeConsonantFrame(
  token: PhonemeToken,
  nextVowel?: string
): VisemeFrame {
  return {
    timeStart: token.start,
    timeEnd: token.end,
    lipModel: null,  // 규칙 6: 스플라인 보간 위임
    tongueModel: getConsonantTongue(token.jamo, nextVowel),
    lipWeight: 0,
    tongueWeight: 0.8,
  };
}

// ── 규칙 7: 양순음 프레임 ───────────────────────────────────

function makeBilabialFrame(token: PhonemeToken): VisemeFrame {
  return {
    timeStart: token.start,
    timeEnd: token.end,
    lipModel: 'L9',    // 규칙 7: 입술 완전 닫힘
    tongueModel: 'T4',
    lipWeight: 1.0,    // 규칙 7: 최대 가중치
    tongueWeight: 0.8,
  };
}

// ── 규칙 10+11: 이중모음 프레임 분리 ───────────────────────

function makeDiphthongFrames(
  token: PhonemeToken,
  lipWeight: number,
  prevVowel: PhonemeToken | null,
  nextConsonant: PhonemeToken | null
): VisemeFrame[] {
  const semivowelType = getSemivowelType(token.jamo);
  const baseVowel = getBaseVowel(token.jamo);
  const mid = token.start + (token.end - token.start) * 0.5; // 규칙 10: ×0.5

  // 반모음 립 모델 (L8=j계열, L9=w계열)
  const semivowelLip: LipModel = semivowelType === 'w' ? 'L9' : 'L8';

  // 규칙 11: 반모음 가중치 = α × prev + β × 기저 모음 가중치
  const prevW = prevVowel ? lipWeight : 0;  // 간소화: prevVowel 가중치를 현재값으로 추정
  const semivowelWeight = clamp(
    DIPHTHONG_ALPHA * prevW + DIPHTHONG_BETA * lipWeight,
    0.1,
    1.0
  );

  const semivowelFrame: VisemeFrame = {
    timeStart: token.start,
    timeEnd: mid,
    lipModel: semivowelLip,
    tongueModel: getVowelTongue(token.jamo),
    lipWeight: semivowelWeight,
    tongueWeight: semivowelWeight,
  };

  const monophthongFrame: VisemeFrame = {
    timeStart: mid,
    timeEnd: token.end,
    lipModel: getVowelLip(baseVowel),
    tongueModel: getVowelTongue(baseVowel),
    lipWeight,
    tongueWeight: lipWeight,
  };

  return [semivowelFrame, monophthongFrame];
}

// ── 규칙 8: 치경음 임계값 적용 ─────────────────────────────

function applyAlveolarThreshold(
  frame: VisemeFrame,
  prevConsonant: PhonemeToken | null,
  nextConsonant: PhonemeToken | null
): VisemeFrame {
  const adjacent = [prevConsonant, nextConsonant].filter(Boolean) as PhonemeToken[];
  const hasAlveolar = adjacent.some(c => ALVEOLARS.has(c.jamo));
  if (!hasAlveolar) return frame;
  return {
    ...frame,
    lipWeight: clamp(frame.lipWeight, 0, ALVEOLAR_LIP_MAX),
  };
}

// ── 규칙 9: 원순 블렌딩 ────────────────────────────────────

function applyRoundingBlend(
  frame: VisemeFrame,
  token: PhonemeToken,
  prevConsonant: PhonemeToken | null,
  nextConsonant: PhonemeToken | null
): VisemeFrame {
  if (!ROUND_VOWELS.has(token.jamo)) return frame;

  const adjacent = [prevConsonant, nextConsonant].filter(Boolean) as PhonemeToken[];
  const hasBilabial = adjacent.some(c => BILABIALS.has(c.jamo));
  if (!hasBilabial) return frame;

  // 원순 모음 + 인접 양순음 → L9를 ROUND_BLEND_WEIGHT 비율로 블렌딩
  return {
    ...frame,
    blendWith: { model: 'L9', weight: ROUND_BLEND_WEIGHT },
  };
}

// ============================================================
// 메인: 규칙 5~12 통합 적용
// ============================================================

/**
 * G2P 규칙 적용 완료된 PhonemeToken[]을 VisemeFrame[]으로 변환
 *
 * 입력 전제:
 *  - assignPositions() 완료 (onset/nucleus/coda 태그)
 *  - calculatePhraseWeights() 완료 (intensity 있는 경우)
 *
 * @param tokens   G2P 적용 완료 토큰
 * @param weights  prosodicWeight 모듈의 calculatePhraseWeights() 결과
 * @returns        VisemeFrame[] (입술 null인 자음 프레임 포함 — splineInterpolator로 후처리)
 */
export function applyCoarticulation(
  tokens: PhonemeToken[],
  weights: number[]
): VisemeFrame[] {
  const frames: VisemeFrame[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const w = weights[i] ?? 0;

    // ── 규칙 12: 짧은 쉼 생략 ─────────────────────────────
    if (token.isPause) {
      if (token.duration < SHORT_PAUSE_THRESHOLD) continue; // 규칙 12: 생략
      // 긴 쉼 → 중립 닫힘 프레임
      frames.push({
        timeStart: token.start,
        timeEnd: token.end,
        lipModel: 'L6',
        tongueModel: 'T6',
        lipWeight: 0.0,
        tongueWeight: 0.0,
      });
      continue;
    }

    // 인접 토큰 조회
    const prevConsonant = findNearestConsonant(tokens, i, -1);
    const nextConsonant = findNearestConsonant(tokens, i, 1);
    const prevVowel = findNearestVowel(tokens, i, -1);

    // ── 모음 처리 ─────────────────────────────────────────
    if (token.isVowel) {
      // 규칙 10+11: 이중모음 분리
      if (token.isDiphthong) {
        const dipFrames = makeDiphthongFrames(token, w, prevVowel, nextConsonant);
        for (const f of dipFrames) {
          frames.push(
            applyRoundingBlend(
              applyAlveolarThreshold(f, prevConsonant, nextConsonant),
              token, prevConsonant, nextConsonant
            )
          );
        }
        continue;
      }

      // 규칙 5: 단모음 매핑
      let frame = makeVowelFrame(token, w);

      // 규칙 8: 치경음 임계값
      frame = applyAlveolarThreshold(frame, prevConsonant, nextConsonant);

      // 규칙 9: 원순 블렌딩
      frame = applyRoundingBlend(frame, token, prevConsonant, nextConsonant);

      frames.push(frame);
      continue;
    }

    // ── 자음 처리 ─────────────────────────────────────────

    // 규칙 7: 양순음 → 입술 완전 닫힘
    if (BILABIALS.has(token.jamo)) {
      frames.push(makeBilabialFrame(token));
      continue;
    }

    // 다음 모음 찾기 (T5 판별용)
    const nextVowelToken = findNearestVowel(tokens, i, 1);
    const nextVowelJamo = nextVowelToken?.jamo;

    // 규칙 6: 일반 자음 → 혀만 매핑, 입술은 null
    frames.push(makeConsonantFrame(token, nextVowelJamo));
  }

  return frames;
}
