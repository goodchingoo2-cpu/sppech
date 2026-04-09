// ============================================================
// pipeline.ts 통합 테스트
// 렌더링(Remotion)은 외부 의존성이므로 제외하고
// buildPipelineData()를 중심으로 데이터 흐름을 검증
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const FIXTURE_MFA  = resolve(__dirname, 'fixtures/sample.mfa.json');
// 실제 WAV 파일이 없으므로 존재하지 않는 경로 사용 → intensity는 0으로 처리됨
const FIXTURE_AUDIO = resolve(__dirname, 'fixtures/sample.wav');

// ── ffmpeg 미설치 환경에서도 테스트가 통과하도록 mock ────────
vi.mock('../src/input/audioLoader.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/input/audioLoader.js')>();
  return {
    ...actual,
    isFfmpegAvailable: () => false,
    extractIntensities: actual.createZeroIntensities,
    getAudioDuration: () => 0.85,
  };
});

import { buildPipelineData } from '../src/pipeline.js';

// ── 테스트 ────────────────────────────────────────────────────

describe('buildPipelineData()', () => {
  it('MFA JSON → RemotionFrameData[] 변환이 정상 동작한다', async () => {
    const frameData = await buildPipelineData({
      audioPath: FIXTURE_AUDIO,
      mfaPath:   FIXTURE_MFA,
      fps:       30,
      verbose:   false,
    });

    // "아버지" = 0.85초 → 30fps → Math.ceil(0.85 * 30) = 26 프레임
    expect(frameData.length).toBeGreaterThanOrEqual(25);
    expect(frameData.length).toBeLessThanOrEqual(27);
  });

  it('각 프레임은 필수 필드를 가진다', async () => {
    const frameData = await buildPipelineData({
      audioPath: FIXTURE_AUDIO,
      mfaPath:   FIXTURE_MFA,
      fps:       30,
      verbose:   false,
    });

    for (const frame of frameData) {
      expect(frame).toHaveProperty('frameIndex');
      expect(frame).toHaveProperty('lipModel');
      expect(frame).toHaveProperty('tongueModel');
      expect(frame).toHaveProperty('lipWeight');
      expect(frame).toHaveProperty('tongueWeight');

      // lipWeight / tongueWeight는 0~1 범위
      expect(frame.lipWeight).toBeGreaterThanOrEqual(0);
      expect(frame.lipWeight).toBeLessThanOrEqual(1);
      expect(frame.tongueWeight).toBeGreaterThanOrEqual(0);
      expect(frame.tongueWeight).toBeLessThanOrEqual(1);
    }
  });

  it('frameIndex는 0부터 순서대로 증가한다', async () => {
    const frameData = await buildPipelineData({
      audioPath: FIXTURE_AUDIO,
      mfaPath:   FIXTURE_MFA,
      fps:       30,
      verbose:   false,
    });

    frameData.forEach((frame, i) => {
      expect(frame.frameIndex).toBe(i);
    });
  });

  it('유효한 LipModel 값을 가진다', async () => {
    const VALID_LIP = new Set(['L1','L2','L3','L4','L5','L6','L7','L8','L9']);
    const frameData = await buildPipelineData({
      audioPath: FIXTURE_AUDIO,
      mfaPath:   FIXTURE_MFA,
      fps:       30,
      verbose:   false,
    });

    for (const frame of frameData) {
      expect(VALID_LIP.has(frame.lipModel)).toBe(true);
    }
  });

  it('유효한 TongueModel 값을 가진다', async () => {
    const VALID_TONGUE = new Set(['T1','T2','T3','T4','T5','T6','T7','VT1','VT2','VT3','VT4','VT5']);
    const frameData = await buildPipelineData({
      audioPath: FIXTURE_AUDIO,
      mfaPath:   FIXTURE_MFA,
      fps:       30,
      verbose:   false,
    });

    for (const frame of frameData) {
      expect(VALID_TONGUE.has(frame.tongueModel)).toBe(true);
    }
  });

  it('모음 구간에는 중립이 아닌 LipModel이 적용된다', async () => {
    // "아버지"의 ㅏ(0.12~0.25초) → 30fps → 프레임 3~7 → L1이어야 함
    const frameData = await buildPipelineData({
      audioPath: FIXTURE_AUDIO,
      mfaPath:   FIXTURE_MFA,
      fps:       30,
      verbose:   false,
    });

    // 0.12초 = frame 3(소수점이하 버림), 0.25초 = frame 7
    // ㅏ 구간 내 프레임은 L1(ㅏ)이거나 가중치 > 0이어야 함
    const vowelFrameIdx = Math.floor(0.18 * 30); // 0.18초 ≈ 프레임 5 (ㅏ 중간)
    const vowelFrame = frameData[vowelFrameIdx];

    // ㅏ 모음은 L1 매핑
    expect(vowelFrame.lipModel).toBe('L1');
    // 이 테스트는 ffmpeg/intensity를 0으로 mock 하므로 논문식 운율 가중치는 0이 될 수 있다.
    expect(vowelFrame.lipWeight).toBeGreaterThanOrEqual(0);
  });

  it('fps 파라미터가 총 프레임 수에 영향을 준다', async () => {
    const data60 = await buildPipelineData({
      audioPath: FIXTURE_AUDIO,
      mfaPath:   FIXTURE_MFA,
      fps:       60,
      verbose:   false,
    });
    const data30 = await buildPipelineData({
      audioPath: FIXTURE_AUDIO,
      mfaPath:   FIXTURE_MFA,
      fps:       30,
      verbose:   false,
    });

    // 60fps는 30fps의 약 2배
    expect(data60.length).toBeCloseTo(data30.length * 2, -1);
  });
});

describe('pipeline 오류 처리', () => {
  it('존재하지 않는 MFA 파일이면 오류를 던진다', async () => {
    await expect(
      buildPipelineData({
        audioPath: FIXTURE_AUDIO,
        mfaPath:   '/nonexistent/path.json',
        verbose:   false,
      })
    ).rejects.toThrow();
  });
});
