// ============================================================
// ElevenLabs TTS — 텍스트 → MP3 파일 생성
// ============================================================

import 'dotenv/config';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function synthesizeSpeech(
  text: string,
  outputPath: string,
): Promise<{ durationSec: number }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    throw new Error('[ElevenLabs] .env에 ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID 필요');
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[ElevenLabs] API 오류 ${res.status}: ${err}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(outputPath, buffer);

  // ffprobe로 실제 오디오 길이 측정 (128kbps 추정 대신 정확한 값 사용)
  let durationSec: number;
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      outputPath,
    ]);
    durationSec = parseFloat(stdout.trim());
    if (!isFinite(durationSec) || durationSec <= 0) throw new Error('invalid duration');
  } catch {
    // ffprobe 실패 시 128kbps 추정으로 폴백
    durationSec = buffer.byteLength / (128000 / 8);
  }

  return { durationSec };
}
