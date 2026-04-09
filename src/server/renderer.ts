// ============================================================
// renderer.ts — Remotion 렌더 + FFmpeg 오디오 합성
// ============================================================

import path from 'path';
import fs from 'fs/promises';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import ffmpeg from 'fluent-ffmpeg';
import type { RemotionFrameData } from '../input/types.js';

// 번들 캐시 (서버 재시작 전까지 재사용)
let bundleCache: string | null = null;

async function getBundle(): Promise<string> {
  if (bundleCache) return bundleCache;

  console.log('[Renderer] Remotion 번들링 중...');
  bundleCache = await bundle({
    entryPoint: path.resolve(process.cwd(), 'src/index.tsx'),
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
  });
  console.log('[Renderer] 번들 완료');
  return bundleCache;
}

function mergeAudioVideo(
  silentMp4: string,
  audioPath: string,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(silentMp4)
      .input(audioPath)
      .videoCodec('copy')
      .audioCodec('aac')
      .outputOptions(['-shortest', '-movflags', '+faststart'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`[FFmpeg] ${err.message}`)))
      .run();
  });
}

export async function renderVideo(
  frameData: RemotionFrameData[],
  audioPath: string,
  outputPath: string,
): Promise<void> {
  const silentPath = outputPath + '.silent.mp4';

  try {
    const bundlePath = await getBundle();

    // 컴포지션 선택
    const composition = await selectComposition({
      serveUrl: bundlePath,
      id: 'FaceAnimation',
      inputProps: { frameData },
    });

    // 무음 MP4 렌더링
    console.log(`[Renderer] 렌더링 중... (${frameData.length}프레임)`);
    await renderMedia({
      composition: {
        ...composition,
        durationInFrames: frameData.length,
      },
      serveUrl: bundlePath,
      codec: 'h264',
      outputLocation: silentPath,
      inputProps: { frameData },
    });

    // FFmpeg로 오디오 합성
    console.log('[Renderer] 오디오 합성 중...');
    await mergeAudioVideo(silentPath, audioPath, outputPath);

    console.log(`[Renderer] 완료: ${outputPath}`);
  } finally {
    // 임시 파일 삭제
    await fs.unlink(silentPath).catch(() => {});
  }
}
