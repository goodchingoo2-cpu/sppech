#!/usr/bin/env node
// ============================================================
// Korean Speech Animation System — CLI 진입점
//
// 사용법:
//   npx tsx src/cli.ts --audio speech.wav --mfa alignment.json
//   npx tsx src/cli.ts --audio speech.wav --mfa alignment.json --output out.mp4 --fps 30
//   npx tsx src/cli.ts --audio speech.wav --mfa alignment.json --preview
// ============================================================

import { Command, Option } from 'commander';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { runPipeline, buildPipelineData } from './pipeline.js';

// ── 버전 정보 ─────────────────────────────────────────────────
const VERSION = '0.1.0';

// ── CLI 정의 ─────────────────────────────────────────────────

const program = new Command();

program
  .name('korean-speech-animation')
  .description('한국어 음성 기반 2D 얼굴 애니메이션 MP4 생성기')
  .version(VERSION);

// ── render 서브커맨드 (기본 동작) ────────────────────────────

program
  .command('render', { isDefault: true })
  .description('음성 파일과 MFA 정렬 데이터를 읽어 MP4 애니메이션을 생성합니다')
  .requiredOption('-a, --audio <path>', '입력 WAV 파일 경로')
  .requiredOption('-m, --mfa <path>',   'MFA 출력 JSON 파일 경로')
  .option('-o, --output <path>',        '출력 MP4 파일 경로', 'output.mp4')
  .addOption(
    new Option('-f, --fps <number>', '비디오 프레임레이트')
      .default(30)
      .argParser((v) => {
        const n = parseInt(v, 10);
        if (isNaN(n) || n < 1 || n > 120) {
          console.error('오류: --fps는 1~120 사이의 정수여야 합니다');
          process.exit(1);
        }
        return n;
      })
  )
  .option('-q, --quiet', '진행 상황 출력 최소화', false)
  .action(async (opts) => {
    const audioPath  = resolve(opts.audio);
    const mfaPath    = resolve(opts.mfa);
    const outputPath = resolve(opts.output);
    const fps        = opts.fps as number;
    const verbose    = !opts.quiet;

    // 입력 파일 존재 사전 검증
    if (!existsSync(audioPath)) {
      console.error(`오류: 오디오 파일을 찾을 수 없습니다 → ${audioPath}`);
      process.exit(1);
    }
    if (!existsSync(mfaPath)) {
      console.error(`오류: MFA JSON 파일을 찾을 수 없습니다 → ${mfaPath}`);
      process.exit(1);
    }

    if (verbose) {
      console.log('='.repeat(60));
      console.log('  Korean Speech Animation System  v' + VERSION);
      console.log('='.repeat(60));
      console.log(`  오디오  : ${audioPath}`);
      console.log(`  MFA     : ${mfaPath}`);
      console.log(`  출력    : ${outputPath}`);
      console.log(`  FPS     : ${fps}`);
      console.log('='.repeat(60));
    }

    try {
      const result = await runPipeline({ audioPath, mfaPath, outputPath, fps, verbose });
      if (verbose) {
        console.log('');
        console.log('='.repeat(60));
        console.log(`  ✔ 완료`);
        console.log(`  출력 파일  : ${result.outputPath}`);
        console.log(`  총 프레임  : ${result.totalFrames}`);
        console.log(`  재생 시간  : ${result.durationSec.toFixed(2)}초`);
        console.log('='.repeat(60));
      }
    } catch (err) {
      console.error('');
      console.error('렌더링 실패:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ── preview 서브커맨드 ────────────────────────────────────────

program
  .command('preview')
  .description('렌더링 없이 파이프라인 데이터를 JSON으로 출력합니다 (디버깅용)')
  .requiredOption('-a, --audio <path>', '입력 WAV 파일 경로')
  .requiredOption('-m, --mfa <path>',   'MFA 출력 JSON 파일 경로')
  .addOption(
    new Option('-f, --fps <number>', '비디오 프레임레이트')
      .default(30)
      .argParser((v) => parseInt(v, 10))
  )
  .option('-n, --limit <number>', '출력할 최대 프레임 수 (기본: 전체)', '0')
  .action(async (opts) => {
    const audioPath = resolve(opts.audio);
    const mfaPath   = resolve(opts.mfa);
    const fps       = opts.fps as number;
    const limit     = parseInt(opts.limit, 10);

    try {
      const frameData = await buildPipelineData({ audioPath, mfaPath, fps, verbose: true });
      const output = limit > 0 ? frameData.slice(0, limit) : frameData;
      console.log(JSON.stringify(output, null, 2));
    } catch (err) {
      console.error('preview 실패:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ── info 서브커맨드 ───────────────────────────────────────────

program
  .command('info')
  .description('MFA JSON 파일의 음소 정보를 요약 출력합니다')
  .requiredOption('-m, --mfa <path>', 'MFA 출력 JSON 파일 경로')
  .action(async (opts) => {
    const mfaPath = resolve(opts.mfa);
    if (!existsSync(mfaPath)) {
      console.error(`오류: 파일을 찾을 수 없습니다 → ${mfaPath}`);
      process.exit(1);
    }

    const { parseMFA } = await import('./input/mfaParser.js');
    const tokens = parseMFA(mfaPath, []);

    const phonemes = tokens.filter((t) => !t.isPause);
    const pauses   = tokens.filter((t) => t.isPause);
    const vowels   = phonemes.filter((t) => t.isVowel);
    const consonants = phonemes.filter((t) => !t.isVowel);
    const duration = tokens.length > 0 ? tokens[tokens.length - 1].end : 0;

    console.log('='.repeat(50));
    console.log(`  MFA 정보: ${mfaPath}`);
    console.log('='.repeat(50));
    console.log(`  전체 길이  : ${duration.toFixed(3)}초`);
    console.log(`  음소 수    : ${phonemes.length} (모음 ${vowels.length}, 자음 ${consonants.length})`);
    console.log(`  무음 구간  : ${pauses.length}개`);
    console.log('');
    console.log('  음소 목록:');
    tokens.forEach((t, i) => {
      const label = t.isPause ? `[무음 ${t.duration.toFixed(3)}s]` : `${t.jamo}(${t.position})`;
      console.log(`    [${i.toString().padStart(3)}] ${t.start.toFixed(3)}~${t.end.toFixed(3)}s  ${label}`);
    });
    console.log('='.repeat(50));
  });

// ── 파싱 실행 ────────────────────────────────────────────────

program.parseAsync(process.argv).catch((err) => {
  console.error('CLI 오류:', err);
  process.exit(1);
});
