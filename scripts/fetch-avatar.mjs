#!/usr/bin/env node
/**
 * Ready Player Me GLB 다운로드 스크립트.
 *
 * 사용:
 *   npm run fetch:avatar
 *
 * 환경변수:
 *   AVATAR_URL          RPM 모델 URL. 미설정 시 DEFAULT_SAMPLE_URL 사용.
 *   AVATAR_OUTPUT       저장 경로 (기본 assets/models/tutor.glb)
 *
 * 실패해도 빌드를 막지 않도록 종료 코드 0을 유지하되, 명확한 경고를 남긴다.
 */

import { mkdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// RPM 공식 visage 예제 저장소에 커밋된 half-body GLB.
// GitHub raw로 서빙되므로 RPM CDN에 접근 못하는 환경에서도 받을 수 있다.
// ARKit 52 + Oculus Visemes 15 블렌드셰이프 모두 포함되어 있음을 확인.
// 사용자가 본인 아바타를 만들면 .env의 AVATAR_URL로 교체.
const DEFAULT_SAMPLE_URL =
  'https://raw.githubusercontent.com/readyplayerme/visage/main/public/half-body.glb';

const url = process.env.AVATAR_URL ?? DEFAULT_SAMPLE_URL;
const output = resolve(ROOT, process.env.AVATAR_OUTPUT ?? 'assets/models/tutor.glb');

if (existsSync(output)) {
  const size = statSync(output).size;
  if (size > 100_000) {
    console.log(`[fetch-avatar] already exists: ${output} (${(size / 1024).toFixed(1)} KB). skip.`);
    process.exit(0);
  }
}

console.log(`[fetch-avatar] downloading: ${url}`);
console.log(`[fetch-avatar] destination: ${output}`);

try {
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`[fetch-avatar] HTTP ${res.status} ${res.statusText}`);
    console.warn('[fetch-avatar] sample URL may have expired. Create your own at https://readyplayer.me/avatar');
    console.warn('[fetch-avatar] then set AVATAR_URL in .env');
    process.exit(0);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, buf);
  console.log(`[fetch-avatar] done: ${(buf.length / 1024).toFixed(1)} KB`);
} catch (err) {
  console.warn(`[fetch-avatar] failed: ${err?.message ?? err}`);
  console.warn('[fetch-avatar] App will run with placeholder avatar. Set AVATAR_URL and rerun.');
  process.exit(0);
}
