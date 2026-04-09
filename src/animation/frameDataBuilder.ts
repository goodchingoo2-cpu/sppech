// ============================================================
// 프레임 데이터 빌더
// VisemeFrame[] → RemotionFrameData[] (30fps 인덱스 배열)
// 이진 탐색으로 각 비디오 프레임의 활성 Viseme를 O(log n) 조회
// ============================================================

import type { VisemeFrame, RemotionFrameData, LipModel, TongueModel } from '../input/types.js';
import { clamp } from '../utils/mathUtils.js';

/** 기본값: 활성 Viseme가 없는 구간의 중립 상태 */
const NEUTRAL: Omit<RemotionFrameData, 'frameIndex'> = {
  lipModel: 'L6',    // ㅡ (입술 수평, 자연스러운 중립)
  tongueModel: 'T6', // 초성 ㅇ (혀 중립)
  lipWeight: 0.0,
  tongueWeight: 0.0,
};

/**
 * 이진 탐색: timeSec에 해당하는 VisemeFrame 인덱스 반환
 * @returns 해당 시간이 속하는 프레임 인덱스, 없으면 -1
 */
function binarySearch(frames: VisemeFrame[], timeSec: number): number {
  let lo = 0;
  let hi = frames.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const f = frames[mid];
    if (timeSec < f.timeStart) {
      hi = mid - 1;
    } else if (timeSec >= f.timeEnd) {
      lo = mid + 1;
    } else {
      return mid; // timeStart <= timeSec < timeEnd
    }
  }
  return -1;
}

/**
 * VisemeFrame → RemotionFrameData 변환 (단일 프레임)
 */
function toRemotionData(
  frameIndex: number,
  vf: VisemeFrame | null
): RemotionFrameData {
  if (!vf) {
    return { frameIndex, ...NEUTRAL };
  }
  return {
    frameIndex,
    lipModel: (vf.lipModel ?? NEUTRAL.lipModel) as LipModel,
    tongueModel: (vf.tongueModel ?? NEUTRAL.tongueModel) as TongueModel,
    lipWeight: clamp(vf.lipWeight, 0, 1),
    tongueWeight: clamp(vf.tongueWeight, 0, 1),
    blendModel: vf.blendWith?.model,
    blendWeight: vf.blendWith?.weight,
  };
}

/**
 * VisemeFrame[] → RemotionFrameData[]
 *
 * @param frames  mapToVisemes()의 출력
 * @param fps     프레임레이트 (기본 30)
 * @returns       비디오 프레임 번호(0~N-1)에 대응하는 RemotionFrameData 배열
 */
export function buildFrameData(
  frames: VisemeFrame[],
  fps = 30
): RemotionFrameData[] {
  if (frames.length === 0) return [];

  const totalSec = frames[frames.length - 1].timeEnd;
  const totalFrames = Math.ceil(totalSec * fps);
  const result: RemotionFrameData[] = new Array(totalFrames);

  for (let f = 0; f < totalFrames; f++) {
    const timeSec = f / fps;
    const idx = binarySearch(frames, timeSec);
    result[f] = toRemotionData(f, idx >= 0 ? frames[idx] : null);
  }

  return result;
}

/**
 * 오디오 길이로 총 프레임 수 계산
 */
export function calcTotalFrames(durationSec: number, fps = 30): number {
  return Math.ceil(durationSec * fps);
}

/**
 * 프레임 번호 → 시간(초) 변환
 */
export function frameToTime(frameIndex: number, fps = 30): number {
  return frameIndex / fps;
}
