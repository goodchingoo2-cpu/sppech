// ============================================================
// ElevenLabs TTS — 텍스트 → MP3 파일 생성
// ============================================================

import 'dotenv/config';
import fs from 'fs/promises';

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

  // 128kbps MP3 기준 duration 추정
  const durationSec = buffer.byteLength / (128000 / 8);

  return { durationSec };
}
