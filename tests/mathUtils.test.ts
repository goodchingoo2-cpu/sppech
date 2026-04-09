import { describe, it, expect } from 'vitest';
import {
  lerp,
  clamp,
  catmullRom,
  rms,
  normalize,
  prosodicWeightRaw,
} from '../src/utils/mathUtils.js';

describe('lerp', () => {
  it('t=0 → a 반환', () => expect(lerp(0, 10, 0)).toBe(0));
  it('t=1 → b 반환', () => expect(lerp(0, 10, 1)).toBe(10));
  it('t=0.5 → 중간값', () => expect(lerp(0, 10, 0.5)).toBe(5));
  it('음수 범위', () => expect(lerp(-4, 4, 0.5)).toBe(0));
});

describe('clamp', () => {
  it('min 미만 → min 반환', () => expect(clamp(-1, 0, 1)).toBe(0));
  it('max 초과 → max 반환', () => expect(clamp(5, 0, 1)).toBe(1));
  it('범위 내 → 그대로', () => expect(clamp(0.5, 0, 1)).toBe(0.5));
});

describe('catmullRom', () => {
  it('t=0 → p1 반환', () => {
    expect(catmullRom(0, 1, 2, 3, 0)).toBeCloseTo(1);
  });
  it('t=1 → p2 반환', () => {
    expect(catmullRom(0, 1, 2, 3, 1)).toBeCloseTo(2);
  });
  it('등간격 직선의 중간값 = 직선 보간', () => {
    // 등간격 직선(0,1,2,3)에서 t=0.5이면 1.5
    expect(catmullRom(0, 1, 2, 3, 0.5)).toBeCloseTo(1.5);
  });
});

describe('rms', () => {
  it('빈 배열 → 0', () => {
    expect(rms(new Float32Array(0))).toBe(0);
  });
  it('모든 값 0 → 0', () => {
    expect(rms(new Float32Array([0, 0, 0]))).toBe(0);
  });
  it('[1, -1] → 1', () => {
    expect(rms(new Float32Array([1, -1]))).toBeCloseTo(1);
  });
  it('[3, 4] → 3.535...', () => {
    expect(rms(new Float32Array([3, 4]))).toBeCloseTo(Math.sqrt((9 + 16) / 2));
  });
});

describe('normalize', () => {
  it('빈 배열 → 빈 배열', () => {
    expect(normalize([])).toEqual([]);
  });
  it('모든 값 같음 → 전부 0', () => {
    expect(normalize([5, 5, 5])).toEqual([0, 0, 0]);
  });
  it('[0, 5, 10] → [0, 0.5, 1]', () => {
    expect(normalize([0, 5, 10])).toEqual([0, 0.5, 1]);
  });
});

describe('prosodicWeightRaw', () => {
  it('intensity=0이면 0 반환', () => {
    expect(prosodicWeightRaw(0, 1)).toBeCloseTo(0);
  });
  it('결과는 0~1 범위', () => {
    expect(prosodicWeightRaw(100, 0.001)).toBeGreaterThanOrEqual(0);
    expect(prosodicWeightRaw(100, 0.001)).toBeLessThanOrEqual(1);
  });
  it('intensity 증가 시 가중치 증가', () => {
    const w1 = prosodicWeightRaw(10, 0.1);
    const w2 = prosodicWeightRaw(100, 0.1);
    expect(w2).toBeGreaterThan(w1);
  });
  it('a=20, c=0.02 상수값 검증 (intensity=50, duration=0.2)', () => {
    const expected = (20 * (1 - Math.exp(-0.02 * 50))) / ((1 / 0.2) + 20);
    expect(prosodicWeightRaw(50, 0.2)).toBeCloseTo(expected);
  });
});
