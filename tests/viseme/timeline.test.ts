import { describe, it, expect } from 'vitest';
import { generateTimeline, fitTimelineToAudio } from '../../src/viseme/timeline.js';

describe('timeline.generateTimeline', () => {
  it('빈 문자열은 앞뒤 V_REST만 (병합되어 1프레임)', () => {
    const frames = generateTimeline('');
    expect(frames).toHaveLength(1);
    expect(frames[0]!.viseme).toBe('V_REST');
  });

  it('"아" → V_REST, V_A, V_REST 순서', () => {
    const frames = generateTimeline('아');
    expect(frames.map((f) => f.viseme)).toEqual(['V_REST', 'V_A', 'V_REST']);
  });

  it('"마" → V_REST, V_M, V_A, V_REST (초성 ㅁ 포함)', () => {
    const frames = generateTimeline('마');
    expect(frames.map((f) => f.viseme)).toEqual(['V_REST', 'V_M', 'V_A', 'V_REST']);
  });

  it('"안녕" 시퀀스 확인', () => {
    // 안: ㅇ(무음)+ㅏ+ㄴ → V_A, V_N
    // 녕: ㄴ+ㅕ(EO)+ㅇ(NG) → V_N, V_EO, V_NG
    // 앞뒤 V_REST
    // 녕의 V_N과 안의 V_N은 인접 → 병합됨
    const frames = generateTimeline('안녕');
    expect(frames.map((f) => f.viseme)).toEqual([
      'V_REST', 'V_A', 'V_N', 'V_EO', 'V_NG', 'V_REST',
    ]);
  });

  it('"와" → 활음 V_O, V_A', () => {
    const frames = generateTimeline('와');
    expect(frames.map((f) => f.viseme)).toEqual(['V_REST', 'V_O', 'V_A', 'V_REST']);
  });

  it('프레임 시간은 단조 증가하고 연속', () => {
    const frames = generateTimeline('안녕하세요');
    for (let i = 0; i < frames.length; i++) {
      expect(frames[i]!.endMs).toBeGreaterThan(frames[i]!.startMs);
      if (i > 0) {
        expect(frames[i]!.startMs).toBe(frames[i - 1]!.endMs);
      }
    }
  });

  it('speed=0.5는 speed=1보다 정확히 약 2배 길이', () => {
    const fast = generateTimeline('안녕하세요', { speed: 1.0 });
    const slow = generateTimeline('안녕하세요', { speed: 0.5 });
    const fastEnd = fast[fast.length - 1]!.endMs;
    const slowEnd = slow[slow.length - 1]!.endMs;
    const ratio = slowEnd / fastEnd;
    expect(ratio).toBeGreaterThan(1.9);
    expect(ratio).toBeLessThan(2.1);
  });

  it('speed <= 0 이면 예외', () => {
    expect(() => generateTimeline('아', { speed: 0 })).toThrow();
  });

  it('공백은 V_SIL을 생성', () => {
    const frames = generateTimeline('아 아');
    // V_REST, V_A, V_SIL, V_A, V_REST
    expect(frames.map((f) => f.viseme)).toEqual(['V_REST', 'V_A', 'V_SIL', 'V_A', 'V_REST']);
  });

  it('문장부호(.)는 더 긴 V_SIL', () => {
    const withDot = generateTimeline('아.');
    const withSpace = generateTimeline('아 ');
    // 마지막 프레임 앞의 V_SIL 길이 비교
    const silDot = withDot.find((f) => f.viseme === 'V_SIL')!;
    const silSp  = withSpace.find((f) => f.viseme === 'V_SIL')!;
    expect(silDot.endMs - silDot.startMs).toBeGreaterThan(silSp.endMs - silSp.startMs);
  });
});

describe('timeline.fitTimelineToAudio', () => {
  it('전체 길이를 타겟 길이로 스케일', () => {
    const original = generateTimeline('안녕');
    const totalOrig = original[original.length - 1]!.endMs;
    const fit = fitTimelineToAudio(original, totalOrig * 2);
    const totalFit = fit[fit.length - 1]!.endMs;
    expect(totalFit).toBeGreaterThanOrEqual(totalOrig * 2 - 2);
    expect(totalFit).toBeLessThanOrEqual(totalOrig * 2 + 2);
  });

  it('빈 배열은 빈 배열', () => {
    expect(fitTimelineToAudio([], 1000)).toEqual([]);
  });
});
