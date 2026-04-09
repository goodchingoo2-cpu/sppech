// ============================================================
// 오디오 로더
// WAV 파일 → 음소 구간별 RMS intensity 배열 추출
// ============================================================

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { rms, normalize } from '../utils/mathUtils.js';
import type { PhonemeToken } from './types.js';

/** 오디오 로더 옵션 */
export interface AudioLoaderOptions {
  /** 샘플레이트 (기본: 16000 Hz) */
  sampleRate?: number;
  /** RMS 정규화 여부 (기본: true) */
  normalize?: boolean;
}

/**
 * WAV 파일을 ffmpeg로 16-bit PCM raw 데이터로 변환 후
 * 각 음소 구간의 RMS intensity를 추출
 *
 * @param wavPath  WAV 파일 경로
 * @param tokens   파싱된 PhonemeToken 배열 (타이밍 정보 사용)
 * @param options  로더 옵션
 * @returns 각 token에 대응하는 RMS 값 배열 (0~1 정규화)
 */
export function extractIntensities(
  wavPath: string,
  tokens: PhonemeToken[],
  options: AudioLoaderOptions = {}
): number[] {
  const sampleRate = options.sampleRate ?? 16000;
  const shouldNormalize = options.normalize ?? true;

  if (!existsSync(wavPath)) {
    throw new Error(`오디오 파일을 찾을 수 없음: ${wavPath}`);
  }

  // ffmpeg로 임시 raw PCM 파일 생성 (16bit, mono, little-endian)
  const tmpFile = join(tmpdir(), `ksa_audio_${Date.now()}.raw`);

  try {
    execSync(
      `ffmpeg -y -i "${wavPath}" -ar ${sampleRate} -ac 1 -f s16le "${tmpFile}" -loglevel error`,
      { stdio: 'pipe' }
    );

    const rawBuffer = readFileSync(tmpFile);
    const samples = pcmBufferToFloat32(rawBuffer);

    const rawIntensities = tokens.map((token) => {
      if (token.isPause) return 0;
      const startSample = Math.floor(token.start * sampleRate);
      const endSample = Math.min(Math.ceil(token.end * sampleRate), samples.length);
      if (startSample >= endSample) return 0;
      const slice = samples.slice(startSample, endSample);
      return rms(slice);
    });

    return shouldNormalize ? normalize(rawIntensities) : rawIntensities;
  } finally {
    if (existsSync(tmpFile)) {
      unlinkSync(tmpFile);
    }
  }
}

/**
 * 16-bit signed PCM Buffer를 Float32Array로 변환
 * 값 범위: -1.0 ~ 1.0
 */
export function pcmBufferToFloat32(buffer: Buffer): Float32Array {
  const samples = new Float32Array(buffer.length / 2);
  for (let i = 0; i < samples.length; i++) {
    const int16 = buffer.readInt16LE(i * 2);
    samples[i] = int16 / 32768.0;
  }
  return samples;
}

/**
 * WAV 파일의 전체 지속 시간을 ffprobe로 조회 (초 단위)
 * ffmpeg가 없는 환경에서는 -1 반환
 */
export function getAudioDuration(wavPath: string): number {
  try {
    const output = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${wavPath}"`,
      { stdio: 'pipe' }
    ).toString().trim();
    return parseFloat(output);
  } catch {
    return -1;
  }
}

/**
 * ffmpeg 설치 여부 확인
 */
export function isFfmpegAvailable(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 테스트/오프라인 환경용: 실제 오디오 없이 모든 intensity를 0으로 설정
 * MFA 파서 테스트나 초기 개발 시 사용
 */
export function createZeroIntensities(tokens: PhonemeToken[]): number[] {
  return tokens.map(() => 0);
}

/**
 * 테스트/오프라인 환경용: 모음에는 임의 intensity, 자음/pause에는 0 설정
 * 음운 규칙 테스트에서 운율 가중치 동작 확인에 사용
 */
export function createMockIntensities(tokens: PhonemeToken[]): number[] {
  const values = tokens.map((t) => {
    if (t.isPause || !t.isVowel) return 0;
    // 시간에 따라 변하는 임의 강도 (0.3 ~ 0.9 범위)
    return 0.3 + ((t.start * 1000) % 100) / 166;
  });
  return values;
}
