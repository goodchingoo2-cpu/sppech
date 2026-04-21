/**
 * Vite 설정.
 *
 * 주요 추가 사항:
 *  1) COOP/COEP 헤더 — SharedArrayBuffer 허용 (wllama 멀티스레드 WASM 필수)
 *  2) /wllama/* 미들웨어 — node_modules에서 wllama WASM 파일 서빙
 *  3) /local-model/* 미들웨어 — LM Studio에 저장된 GGUF 파일을
 *     복사 없이 스트리밍 서빙 (Range request 지원)
 *  4) /lmstudio 프록시 — LM Studio HTTP API 폴백용 유지
 */

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// LM Studio 에서 다운로드한 Gemma 4 E2B GGUF 파일 경로
// ---------------------------------------------------------------------------
const HOME = process.env.USERPROFILE ?? process.env.HOME ?? '';
const GGUF_PATH = path.join(
  HOME,
  '.lmstudio',
  'models',
  'lmstudio-community',
  'gemma-4-E2B-it-GGUF',
  'gemma-4-E2B-it-Q4_K_M.gguf',
);

// wllama ESM 디렉토리 (node_modules)
const WLLAMA_ESM = path.resolve('./node_modules/@wllama/wllama/esm');

// ---------------------------------------------------------------------------
// 로컬 에셋 서버 플러그인 (개발 서버 전용)
// ---------------------------------------------------------------------------
function localAssetsPlugin(): Plugin {
  return {
    name: 'local-assets',
    configureServer(server) {
      // ── wllama WASM / worker 파일 서빙 ──────────────────────────────────
      server.middlewares.use('/wllama', (req, res, next) => {
        const rel = (req.url ?? '/').replace(/^\//, '');
        const filePath = path.join(WLLAMA_ESM, rel);
        if (!fs.existsSync(filePath)) { next(); return; }

        const ext = path.extname(filePath);
        const ct =
          ext === '.wasm' ? 'application/wasm' :
          ext === '.mjs'  ? 'text/javascript'   :
          'application/octet-stream';

        res.setHeader('Content-Type', ct);
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        fs.createReadStream(filePath).pipe(res as NodeJS.WritableStream);
      });

      // ── Gemma 4 E2B GGUF 스트리밍 서빙 (Range 요청 지원) ─────────────
      server.middlewares.use('/local-model', (req, res, _next) => {
        if (!fs.existsSync(GGUF_PATH)) {
          res.statusCode = 404;
          res.end(`GGUF 파일을 찾을 수 없습니다: ${GGUF_PATH}`);
          return;
        }

        const stat = fs.statSync(GGUF_PATH);
        const rangeHeader = req.headers['range'];

        if (rangeHeader) {
          // Partial content (Range request)
          const [s, e] = rangeHeader
            .replace('bytes=', '')
            .split('-')
            .map((v, i) => (v ? parseInt(v, 10) : i === 1 ? stat.size - 1 : 0));
          const start = s;
          const end   = Math.min(e, stat.size - 1);
          const chunkSize = end - start + 1;

          res.writeHead(206, {
            'Content-Range':  `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges':  'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type':   'application/octet-stream',
            'Cross-Origin-Resource-Policy': 'same-origin',
          });
          fs.createReadStream(GGUF_PATH, { start, end }).pipe(res as NodeJS.WritableStream);
        } else {
          res.writeHead(200, {
            'Content-Length':  String(stat.size),
            'Content-Type':    'application/octet-stream',
            'Accept-Ranges':   'bytes',
            'Cross-Origin-Resource-Policy': 'same-origin',
          });
          fs.createReadStream(GGUF_PATH).pipe(res as NodeJS.WritableStream);
        }
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Vite 설정
// ---------------------------------------------------------------------------
export default defineConfig({
  plugins: [react(), localAssetsPlugin()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  publicDir: 'assets',

  server: {
    port: 5180,
    strictPort: false,  // 포트 충돌 시 자동으로 다음 포트 사용
    host: '127.0.0.1',
    open: true,         // dev 시작 시 브라우저 자동 열기

    // SharedArrayBuffer 허용 (wllama 멀티스레드 WASM 필수)
    headers: {
      'Cross-Origin-Opener-Policy':   'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },

    // LM Studio HTTP API 폴백 프록시 (엔진 미준비 시 사용)
    proxy: {
      '/lmstudio': {
        target:       'http://127.0.0.1:1234',
        changeOrigin: true,
        rewrite:      (p) => p.replace(/^\/lmstudio/, ''),
      },
    },
  },

  // WASM 파일이 Rollup 에셋으로 처리되지 않도록 제외
  assetsInclude: ['**/*.gguf'],

  optimizeDeps: {
    exclude: ['@wllama/wllama'],
  },
});
