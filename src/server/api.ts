// ============================================================
// Express REST API
// POST /api/animate — 텍스트 → RemotionFrameData[] 반환
// ============================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import type { SpeechRate } from '../korean/phonemeTiming.js';
import { synthesizeSpeech } from './elevenlabs.js';
import { renderVideo } from './renderer.js';
import { buildTextAnimationData } from './textAnimationPipeline.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());

/**
 * POST /api/animate
 * Body: { text: string, rate?: 'slow' | 'normal' | 'fast' }
 * Response: { frames: RemotionFrameData[], duration: number, fps: number }
 */
app.post('/api/animate', (req, res) => {
  const { text, rate = 'normal' } = req.body as { text?: string; rate?: SpeechRate };

  if (!text || typeof text !== 'string' || text.trim() === '') {
    res.status(400).json({ error: '텍스트를 입력해주세요.' });
    return;
  }

  const { frames, durationSec, fps } = buildTextAnimationData(text, { rate, fps: 30 });

  res.json({ frames, duration: durationSec, fps });
});

/**
 * POST /api/render
 * Body: { text: string, rate?: 'slow' | 'normal' | 'fast' }
 * Response: MP4 파일 (application/octet-stream)
 */
app.post('/api/render', async (req, res) => {
  const { text, rate = 'normal' } = req.body as { text?: string; rate?: SpeechRate };

  if (!text || typeof text !== 'string' || text.trim() === '') {
    res.status(400).json({ error: '텍스트를 입력해주세요.' });
    return;
  }

  const tmpDir = os.tmpdir();
  const id = Date.now();
  const audioPath = path.join(tmpDir, `speech-${id}.mp3`);
  const videoPath = path.join(tmpDir, `speech-${id}.mp4`);

  try {
    // 1. ElevenLabs TTS
    console.log(`[API] TTS 생성: "${text}"`);
    const { durationSec } = await synthesizeSpeech(text, audioPath);

    // 2. 프레임 데이터 생성
    const { frames } = buildTextAnimationData(text, {
      rate,
      fps: 30,
      targetDurationSec: durationSec,
    });

    // 3. Remotion 렌더 + FFmpeg 합성
    await renderVideo(frames, audioPath, videoPath);

    // 4. MP4 파일 전송
    const filename = encodeURIComponent(text.slice(0, 20)) + '.mp4';
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const data = await fs.readFile(videoPath);
    res.send(data);
  } catch (err: any) {
    console.error('[API /api/render]', err);
    res.status(500).json({ error: err.message ?? '렌더링 실패' });
  } finally {
    await fs.unlink(audioPath).catch(() => {});
    await fs.unlink(videoPath).catch(() => {});
  }
});

const server = app.listen(PORT, () => {
  console.log(`[Speech Animation API] http://localhost:${PORT}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Speech Animation API] 포트 ${PORT}가 이미 사용 중입니다. 다른 포트로 실행하려면 PORT 환경변수를 설정하세요.`);
    return;
  }

  console.error('[Speech Animation API] 서버 시작 실패', err);
});
