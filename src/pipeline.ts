// ============================================================
// 전체 파이프라인 오케스트레이터
//
// WAV + MFA JSON → MP4
//
// 처리 순서:
//   1. ffmpeg 체크 / 오디오 강도 추출
//   2. MFA JSON 파싱 → PhonemeToken[]
//   3. Viseme 매핑 (G2P + 동시조음 + 스플라인)
//   4. RemotionFrameData[] 빌드
//   5. Remotion 번들링 + renderMedia() 실행
// ============================================================

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, unlinkSync, renameSync } from 'fs';
import { execFileSync } from 'child_process';

import { parseMFA } from './input/mfaParser.js';
import {
  extractIntensities,
  createZeroIntensities,
  isFfmpegAvailable,
  getAudioDuration,
} from './input/audioLoader.js';
import { applyG2PRulesAll } from './korean/g2pRules.js';
import { mapToVisemes } from './viseme/visemeMapper.js';
import { buildFrameData } from './animation/frameDataBuilder.js';
import type { RemotionFrameData } from './input/types.js';

// ESM __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Remotion 진입점 (번들러가 읽을 파일)
const REMOTION_ENTRY = resolve(__dirname, 'index.tsx');

// Remotion Composition ID (Root.tsx에 등록된 이름)
const COMPOSITION_ID = 'FaceAnimation';

// ── 옵션 타입 ─────────────────────────────────────────────────

export interface PipelineOptions {
  /** 입력 WAV 파일 경로 */
  audioPath: string;
  /** MFA 출력 JSON 파일 경로 */
  mfaPath: string;
  /** 출력 MP4 파일 경로 */
  outputPath: string;
  /** 비디오 프레임레이트 (기본 30) */
  fps?: number;
  /** 진행 상황을 콘솔에 출력할지 여부 (기본 true) */
  verbose?: boolean;
}

export interface PipelineResult {
  /** 생성된 MP4 파일 경로 */
  outputPath: string;
  /** 총 프레임 수 */
  totalFrames: number;
  /** 오디오 길이 (초) */
  durationSec: number;
}

// ── 로깅 헬퍼 ────────────────────────────────────────────────

function log(verbose: boolean, msg: string) {
  if (verbose) console.log(`[pipeline] ${msg}`);
}

// ── 메인 파이프라인 ───────────────────────────────────────────

/**
 * Korean Speech Animation 전체 파이프라인 실행
 *
 * @param options  입력 파일 경로, 출력 경로, fps 등
 * @returns 결과 정보 (outputPath, totalFrames, durationSec)
 */
export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const { audioPath, mfaPath, outputPath, fps = 30, verbose = true } = options;

  // ── Step 0: 입력 파일 존재 확인 ──
  if (!existsSync(audioPath)) {
    throw new Error(`오디오 파일을 찾을 수 없음: ${audioPath}`);
  }
  if (!existsSync(mfaPath)) {
    throw new Error(`MFA JSON 파일을 찾을 수 없음: ${mfaPath}`);
  }

  // ── Step 1: MFA 파싱 (1차 — intensity 없이) ──
  log(verbose, `MFA 파싱 중: ${mfaPath}`);
  const rawTokens = parseMFA(mfaPath, []);

  // ── Step 2: 오디오 intensity 추출 ──
  let intensities: number[];
  if (isFfmpegAvailable()) {
    log(verbose, `오디오 강도 추출 중: ${audioPath}`);
    intensities = extractIntensities(audioPath, rawTokens);
  } else {
    console.warn('[pipeline] ffmpeg를 찾을 수 없음 — intensity를 0으로 처리합니다.');
    intensities = createZeroIntensities(rawTokens);
  }

  // ── Step 3: MFA 재파싱 (intensity 주입) ──
  const tokens = parseMFA(mfaPath, intensities);

  // ── Step 4: Viseme 매핑 ──
  log(verbose, 'Viseme 매핑 중 (G2P + 동시조음 + 스플라인)...');
  const g2pTokens = applyG2PRulesAll(tokens);
  const visemeFrames = mapToVisemes(g2pTokens);

  // ── Step 5: RemotionFrameData 빌드 ──
  log(verbose, `프레임 데이터 빌드 중 (${fps}fps)...`);
  const frameData: RemotionFrameData[] = buildFrameData(visemeFrames, fps);
  const totalFrames = frameData.length;

  // 오디오 길이 조회
  const durationSec = getAudioDuration(audioPath);
  const effectiveDuration = durationSec > 0 ? durationSec : totalFrames / fps;

  log(verbose, `총 ${totalFrames} 프레임 (${effectiveDuration.toFixed(2)}초)`);

  // ── Step 6: Remotion 렌더링 ──
  log(verbose, 'Remotion 번들링 중...');

  // @remotion/bundler 동적 임포트 (선택적 의존성)
  let bundleResult: string;
  let renderMediaFn: typeof import('@remotion/renderer').renderMedia;
  let selectCompositionFn: typeof import('@remotion/renderer').selectComposition;

  try {
    const { bundle } = await import('@remotion/bundler');
    const renderer = await import('@remotion/renderer');
    renderMediaFn = renderer.renderMedia;
    selectCompositionFn = renderer.selectComposition;

    bundleResult = await bundle({
      entryPoint: REMOTION_ENTRY,
      // Node.js ESM 스타일 .js 임포트를 webpack이 .ts/.tsx 로 해석하도록 설정
      webpackOverride: (config) => ({
        ...config,
        resolve: {
          ...config.resolve,
          extensionAlias: {
            '.js': ['.tsx', '.ts', '.js'],
            '.mjs': ['.mts', '.mjs'],
          },
        },
      }),
      onProgress: (progress) => {
        if (verbose) process.stdout.write(`\r[pipeline] 번들링: ${Math.round(progress * 100)}%`);
      },
    });
    if (verbose) console.log(''); // 줄바꿈
  } catch (err) {
    throw new Error(
      `Remotion 번들러를 로드할 수 없습니다.\n` +
      `다음 명령으로 설치하세요: npm install @remotion/bundler\n` +
      `원인: ${err}`
    );
  }

  // composition 선택 (실제 durationInFrames / fps 덮어쓰기)
  log(verbose, 'Composition 선택 중...');
  const composition = await selectCompositionFn({
    serveUrl: bundleResult,
    id: COMPOSITION_ID,
    inputProps: { frameData },
  });

  // 렌더링 (오디오 합성 예정이면 임시 파일로 출력)
  const ffmpegOk = isFfmpegAvailable();
  const tempPath = outputPath + '.noaudio.mp4';
  const renderTarget = ffmpegOk ? tempPath : outputPath;

  log(verbose, `MP4 렌더링 중: ${renderTarget}`);
  await renderMediaFn({
    composition: {
      ...composition,
      durationInFrames: totalFrames,
      fps,
    },
    serveUrl: bundleResult,
    codec: 'h264',
    outputLocation: renderTarget,
    inputProps: { frameData },
    onProgress: ({ progress }) => {
      if (verbose) {
        process.stdout.write(`\r[pipeline] 렌더링: ${Math.round(progress * 100)}%`);
      }
    },
  });

  // ── Step 7: ffmpeg 오디오 합성 ──
  if (ffmpegOk) {
    log(verbose, `오디오 합성 중: ${audioPath} → ${outputPath}`);
    try {
      execFileSync('ffmpeg', [
        '-y',
        '-i', tempPath,
        '-i', audioPath,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-shortest',
        outputPath,
      ]);
      unlinkSync(tempPath);
    } catch (err) {
      // 합성 실패 시 영상만 있는 파일이라도 보존
      console.warn(`[pipeline] 오디오 합성 실패, 영상만 저장합니다: ${err}`);
      renameSync(tempPath, outputPath);
    }
  }

  if (verbose) console.log(`\n[pipeline] 완료! → ${outputPath}`);

  return { outputPath, totalFrames, durationSec: effectiveDuration };
}

// ── 파이프라인 데이터만 반환 (렌더링 없이) ────────────────────

/**
 * 렌더링 없이 VisemeFrame → RemotionFrameData 까지만 실행
 * (테스트, 미리보기, 외부 렌더러 연동에 사용)
 */
export async function buildPipelineData(options: {
  audioPath: string;
  mfaPath: string;
  fps?: number;
  verbose?: boolean;
}): Promise<RemotionFrameData[]> {
  const { audioPath, mfaPath, fps = 30, verbose = false } = options;

  const rawTokens = parseMFA(mfaPath, []);

  let intensities: number[];
  if (isFfmpegAvailable() && existsSync(audioPath)) {
    intensities = extractIntensities(audioPath, rawTokens);
  } else {
    if (verbose) console.warn('[pipeline] intensity를 0으로 처리합니다.');
    intensities = createZeroIntensities(rawTokens);
  }

  const tokens = parseMFA(mfaPath, intensities);
  const g2pTokens = applyG2PRulesAll(tokens);
  const visemeFrames = mapToVisemes(g2pTokens);
  return buildFrameData(visemeFrames, fps);
}
