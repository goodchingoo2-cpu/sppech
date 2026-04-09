import { describe, it, expect } from 'vitest';
import { buildFrameData, calcTotalFrames, frameToTime } from '../src/animation/frameDataBuilder.js';
import type { VisemeFrame } from '../src/input/types.js';

// ── 헬퍼 ───────────────────────────────────────────────────

function frame(
  timeStart: number,
  timeEnd: number,
  lipModel = 'L1',
  tongueModel = 'VT2',
  lipWeight = 0.8,
  tongueWeight = 0.8
): VisemeFrame {
  return {
    timeStart, timeEnd,
    lipModel: lipModel as any,
    tongueModel: tongueModel as any,
    lipWeight,
    tongueWeight,
  };
}

// ── buildFrameData ──────────────────────────────────────────

describe('buildFrameData', () => {
  it('빈 프레임 배열 → 빈 결과', () => {
    expect(buildFrameData([])).toEqual([]);
  });

  it('0.1초 1프레임 구간, fps=30 → 3프레임 생성', () => {
    const frames = [frame(0, 0.1)];
    const result = buildFrameData(frames, 30);
    expect(result).toHaveLength(3); // ceil(0.1 * 30) = 3
  });

  it('0.85초 → ceil(0.85*30)=26 프레임', () => {
    const frames = [
      frame(0.00, 0.25, 'L1', 'VT2'),
      frame(0.25, 0.55, 'L9', 'T4'),
      frame(0.55, 0.85, 'L7', 'VT1'),
    ];
    const result = buildFrameData(frames, 30);
    expect(result).toHaveLength(26); // ceil(0.85 * 30) = 26 (실제 25.5 → 26)
  });

  it('각 frameIndex가 순서대로 증가', () => {
    const frames = [frame(0, 1.0)];
    const result = buildFrameData(frames, 30);
    result.forEach((r, i) => expect(r.frameIndex).toBe(i));
  });

  it('VisemeFrame 시작 시간의 프레임 → 해당 모델 반환', () => {
    const frames = [
      frame(0.0, 0.5, 'L1', 'VT2'),
      frame(0.5, 1.0, 'L7', 'VT1'),
    ];
    const result = buildFrameData(frames, 10); // fps=10 → frame0=0.0s, frame5=0.5s
    expect(result[0].lipModel).toBe('L1');  // 0.0s → 첫 번째 구간
    expect(result[5].lipModel).toBe('L7'); // 0.5s → 두 번째 구간
  });

  it('구간 사이 간격(gap) → 중립 모델(L6) 반환', () => {
    const frames = [
      frame(0.0, 0.2, 'L1', 'VT2'),
      // 0.2~0.5 사이 gap
      frame(0.5, 0.8, 'L7', 'VT1'),
    ];
    const result = buildFrameData(frames, 10);
    // frame 3 = 0.3s → gap 구간 → 중립
    expect(result[3].lipModel).toBe('L6');
    expect(result[3].lipWeight).toBe(0.0);
  });

  it('blendWith 있는 프레임 → blendModel, blendWeight 전달', () => {
    const frames: VisemeFrame[] = [{
      timeStart: 0, timeEnd: 0.3,
      lipModel: 'L4', tongueModel: 'VT4',
      lipWeight: 0.8, tongueWeight: 0.8,
      blendWith: { model: 'L9', weight: 0.4 },
    }];
    const result = buildFrameData(frames, 30);
    expect(result[0].blendModel).toBe('L9');
    expect(result[0].blendWeight).toBe(0.4);
  });

  it('blendWith 없는 프레임 → blendModel undefined', () => {
    const frames = [frame(0, 0.3, 'L1', 'VT2')];
    const result = buildFrameData(frames, 30);
    expect(result[0].blendModel).toBeUndefined();
  });

  it('lipWeight 클램핑: 1.0 초과 → 1.0', () => {
    const frames: VisemeFrame[] = [{
      timeStart: 0, timeEnd: 0.1,
      lipModel: 'L9', tongueModel: 'T4',
      lipWeight: 2.0, tongueWeight: 1.5, // 범위 초과
    }];
    const result = buildFrameData(frames, 30);
    expect(result[0].lipWeight).toBe(1.0);
    expect(result[0].tongueWeight).toBe(1.0);
  });

  it('lipModel null이면 중립 L6로 대체', () => {
    const frames: VisemeFrame[] = [{
      timeStart: 0, timeEnd: 0.1,
      lipModel: null,
      tongueModel: 'T1',
      lipWeight: 0.5, tongueWeight: 0.8,
    }];
    const result = buildFrameData(frames, 30);
    expect(result[0].lipModel).toBe('L6');
  });

  it('이진 탐색 정확성: 구간 경계에서 올바른 모델 반환', () => {
    const frames = Array.from({ length: 10 }, (_, i) =>
      frame(i * 0.1, (i + 1) * 0.1, `L${(i % 9) + 1}` as any, 'VT2')
    );
    const result = buildFrameData(frames, 100); // fps=100 → 1ms per frame
    // frame 15 = 0.15s → 두 번째 구간 (0.1~0.2)
    expect(result[15].lipModel).toBe('L2');
    // frame 50 = 0.50s → 여섯 번째 구간 (0.5~0.6)
    expect(result[50].lipModel).toBe('L6');
  });
});

// ── calcTotalFrames / frameToTime ───────────────────────────

describe('calcTotalFrames', () => {
  it('1초, fps=30 → 30프레임', () => {
    expect(calcTotalFrames(1.0, 30)).toBe(30);
  });

  it('0.85초, fps=30 → 26프레임', () => {
    expect(calcTotalFrames(0.85, 30)).toBe(26);
  });

  it('기본값 fps=30', () => {
    expect(calcTotalFrames(1.0)).toBe(30);
  });
});

describe('frameToTime', () => {
  it('frame 0, fps=30 → 0초', () => {
    expect(frameToTime(0, 30)).toBe(0);
  });

  it('frame 30, fps=30 → 1초', () => {
    expect(frameToTime(30, 30)).toBeCloseTo(1.0);
  });

  it('frame 15, fps=30 → 0.5초', () => {
    expect(frameToTime(15, 30)).toBeCloseTo(0.5);
  });
});
