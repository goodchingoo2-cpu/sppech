// ============================================================
// 스플라인 보간기
// 자음 구간에서 인접 모음 입술 모델을 Catmull-Rom으로 부드럽게 연결
// ============================================================

import { catmullRom, clamp, lerp } from '../utils/mathUtils.js';
import type { LipModel, VisemeFrame } from '../input/types.js';

/**
 * 입술 모델 ID → 0~1 수치 인덱스로 변환
 * (스플라인 보간 시 수치 연산을 위해 사용)
 */
const LIP_INDEX: Record<LipModel, number> = {
  L1: 0, L2: 1, L3: 2, L4: 3, L5: 4,
  L6: 5, L7: 6, L8: 7, L9: 8,
};

const INDEX_TO_LIP: LipModel[] = ['L1','L2','L3','L4','L5','L6','L7','L8','L9'];

/** 수치 인덱스를 가장 가까운 LipModel로 변환 */
function indexToLip(index: number): LipModel {
  const clamped = clamp(Math.round(index), 0, 8);
  return INDEX_TO_LIP[clamped];
}

/** 두 LipModel 사이를 t(0~1)로 선형 보간 */
export function lerpLipModel(a: LipModel, b: LipModel, t: number): LipModel {
  const ai = LIP_INDEX[a];
  const bi = LIP_INDEX[b];
  return indexToLip(lerp(ai, bi, t));
}

/**
 * Catmull-Rom 스플라인으로 자음 구간 입술 모델 보간
 *
 * 자음 프레임(lipModel=null)의 전후 모음 프레임을 찾아
 * 자음 위치의 정규화된 t값으로 부드러운 입술 모양을 계산
 *
 * @param frames VisemeFrame[] — lipModel=null인 자음 프레임 포함
 * @returns lipModel이 채워진 VisemeFrame[]
 */
export function fillConsonantLips(frames: VisemeFrame[]): VisemeFrame[] {
  const result = frames.map(f => ({ ...f }));

  for (let i = 0; i < result.length; i++) {
    if (result[i].lipModel !== null) continue; // 이미 모델 있음

    // 앞쪽 모음 프레임 탐색
    let prevIdx = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (result[j].lipModel !== null) { prevIdx = j; break; }
    }

    // 뒤쪽 모음 프레임 탐색
    let nextIdx = -1;
    for (let j = i + 1; j < result.length; j++) {
      if (result[j].lipModel !== null) { nextIdx = j; break; }
    }

    // 경우 1: 앞뒤 모음이 모두 없음 — 중립 모델(L6=ㅡ) 사용
    if (prevIdx === -1 && nextIdx === -1) {
      result[i] = { ...result[i], lipModel: 'L6', lipWeight: 0.3 };
      continue;
    }

    // 경우 2: 앞 모음만 있음 — 앞 모음 모델 유지
    if (prevIdx !== -1 && nextIdx === -1) {
      result[i] = {
        ...result[i],
        lipModel: result[prevIdx].lipModel,
        lipWeight: result[prevIdx].lipWeight * 0.5,
      };
      continue;
    }

    // 경우 3: 뒤 모음만 있음 — 뒤 모음 모델로 선행
    if (prevIdx === -1 && nextIdx !== -1) {
      result[i] = {
        ...result[i],
        lipModel: result[nextIdx].lipModel,
        lipWeight: result[nextIdx].lipWeight * 0.5,
      };
      continue;
    }

    // 경우 4: 앞뒤 모음 모두 있음 — Catmull-Rom 보간
    const prev = result[prevIdx];
    const next = result[nextIdx];

    // 자음의 시간상 위치 t (prev~next 사이 0~1)
    const totalDur = next.timeStart - prev.timeEnd;
    const consonantMid = (result[i].timeStart + result[i].timeEnd) / 2;
    const t = totalDur > 0
      ? clamp((consonantMid - prev.timeEnd) / totalDur, 0, 1)
      : 0.5;

    // p0: prev보다 앞 모음 (없으면 prev와 동일)
    let p0Idx = prevIdx;
    for (let j = prevIdx - 1; j >= 0; j--) {
      if (result[j].lipModel !== null) { p0Idx = j; break; }
    }

    // p3: next보다 뒤 모음 (없으면 next와 동일)
    let p3Idx = nextIdx;
    for (let j = nextIdx + 1; j < result.length; j++) {
      if (result[j].lipModel !== null) { p3Idx = j; break; }
    }

    const p0 = LIP_INDEX[result[p0Idx].lipModel!];
    const p1 = LIP_INDEX[prev.lipModel!];
    const p2 = LIP_INDEX[next.lipModel!];
    const p3 = LIP_INDEX[result[p3Idx].lipModel!];

    const interpolatedIdx = catmullRom(p0, p1, p2, p3, t);
    const interpolatedLip = indexToLip(interpolatedIdx);
    const interpolatedWeight = lerp(prev.lipWeight, next.lipWeight, t);

    result[i] = {
      ...result[i],
      lipModel: interpolatedLip,
      lipWeight: clamp(interpolatedWeight, 0.1, 1.0),
    };
  }

  return result;
}
