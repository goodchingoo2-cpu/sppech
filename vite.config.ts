import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  publicDir: 'assets',
  server: {
    port: 5180,
    strictPort: false, // ?ы듃 ?먯쑀 ???먮룞?쇰줈 ?ㅼ쓬 ?ы듃 ?먯깋
    host: '127.0.0.1',
    open: true,        // dev ?쒖옉 ??釉뚮씪?곗? ?먮룞 ?ㅽ뵂 (?ы듃 ?쇰룞 諛⑹?)
        // LM Studio OpenAI-compatible local server proxy.
    // LM Studio Developer 탭에서 Local Server를 켜고 기본 포트 1234를 사용합니다.
    proxy: {
      '/lmstudio': {
        target: 'http://127.0.0.1:1234',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lmstudio/, ''),
      },
    },
  },
});


