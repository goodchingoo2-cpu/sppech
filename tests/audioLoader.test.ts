import { describe, it, expect } from 'vitest';
import {
  pcmBufferToFloat32,
  createZeroIntensities,
  createMockIntensities,
  isFfmpegAvailable,
} from '../src/input/audioLoader.js';
import type { PhonemeToken } from '../src/input/types.js';

// ── 헬퍼: 테스트용 PhonemeToken 생성 ───────────────────────

function makeToken(
  jamo: string,
  start: number,
  end: number,
  isVowel = false,
  isPause = false
): PhonemeToken {
  return {
    jamo,
    position: isPause ? 'pause' : isVowel ? 'nucleus' : 'onset',
    start,
    end,
    duration: end - start,
    intensity: 0,
    isVowel,
    isPause,
    isDiphthong: false,
  };
}

const SAMPLE_TOKENS: PhonemeToken[] = [
  makeToken('ㅇ', 0.0,  0.12, false, false),
  makeToken('ㅏ', 0.12, 0.25, true,  false),
  makeToken('ㅂ', 0.25, 0.40, false, false),
  makeToken('ㅓ', 0.40, 0.55, true,  false),
  makeToken('ㅈ', 0.55, 0.68, false, false),
  makeToken('ㅣ', 0.68, 0.85, true,  false),
];

const TOKENS_WITH_PAUSE: PhonemeToken[] = [
  makeToken('ㅏ', 0.0, 0.2, true,  false),
  makeToken('',   0.2, 0.7, false, true),   // pause
  makeToken('ㅣ', 0.7, 0.9, true,  false),
];

// ── pcmBufferToFloat32 ──────────────────────────────────────

describe('pcmBufferToFloat32', () => {
  it('빈 버퍼 → 빈 Float32Array', () => {
    const result = pcmBufferToFloat32(Buffer.alloc(0));
    expect(result.length).toBe(0);
  });

  it('0x0000, 0x0000 → [0, 0]', () => {
    const buf = Buffer.alloc(4, 0);
    const result = pcmBufferToFloat32(buf);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
  });

  it('32767 (int16 max) → 약 1.0', () => {
    const buf = Buffer.alloc(2);
    buf.writeInt16LE(32767, 0);
    const result = pcmBufferToFloat32(buf);
    expect(result[0]).toBeCloseTo(1.0, 3);
  });

  it('-32768 (int16 min) → 약 -1.0', () => {
    const buf = Buffer.alloc(2);
    buf.writeInt16LE(-32768, 0);
    const result = pcmBufferToFloat32(buf);
    expect(result[0]).toBeCloseTo(-1.0, 3);
  });

  it('2바이트당 1 샘플 생성', () => {
    const buf = Buffer.alloc(8); // 4 샘플
    const result = pcmBufferToFloat32(buf);
    expect(result.length).toBe(4);
  });

  it('양수/음수 대칭 변환', () => {
    const buf = Buffer.alloc(4);
    buf.writeInt16LE(16384, 0);   // +0.5
    buf.writeInt16LE(-16384, 2);  // -0.5
    const result = pcmBufferToFloat32(buf);
    expect(result[0]).toBeCloseTo(0.5, 2);
    expect(result[1]).toBeCloseTo(-0.5, 2);
  });
});

// ── createZeroIntensities ───────────────────────────────────

describe('createZeroIntensities', () => {
  it('모든 토큰에 대해 0 반환', () => {
    const result = createZeroIntensities(SAMPLE_TOKENS);
    expect(result).toHaveLength(SAMPLE_TOKENS.length);
    expect(result.every(v => v === 0)).toBe(true);
  });

  it('빈 배열 → 빈 배열', () => {
    expect(createZeroIntensities([])).toEqual([]);
  });

  it('pause 포함 토큰도 0', () => {
    const result = createZeroIntensities(TOKENS_WITH_PAUSE);
    expect(result).toHaveLength(3);
    expect(result[1]).toBe(0); // pause
  });
});

// ── createMockIntensities ───────────────────────────────────

describe('createMockIntensities', () => {
  it('토큰 수와 배열 길이 일치', () => {
    const result = createMockIntensities(SAMPLE_TOKENS);
    expect(result).toHaveLength(SAMPLE_TOKENS.length);
  });

  it('pause intensity는 0', () => {
    const result = createMockIntensities(TOKENS_WITH_PAUSE);
    expect(result[1]).toBe(0); // pause 토큰
  });

  it('자음 intensity는 0', () => {
    const result = createMockIntensities(SAMPLE_TOKENS);
    expect(result[0]).toBe(0); // ㅇ (자음)
    expect(result[2]).toBe(0); // ㅂ (자음)
  });

  it('모음 intensity는 0보다 큰 값', () => {
    const result = createMockIntensities(SAMPLE_TOKENS);
    expect(result[1]).toBeGreaterThan(0); // ㅏ
    expect(result[3]).toBeGreaterThan(0); // ㅓ
    expect(result[5]).toBeGreaterThan(0); // ㅣ
  });

  it('빈 배열 → 빈 배열', () => {
    expect(createMockIntensities([])).toEqual([]);
  });
});

// ── isFfmpegAvailable ───────────────────────────────────────

describe('isFfmpegAvailable', () => {
  it('boolean 값 반환', () => {
    const result = isFfmpegAvailable();
    expect(typeof result).toBe('boolean');
  });
});
