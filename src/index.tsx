/**
 * Remotion 진입점
 *
 * `npx remotion studio` 또는 `npx remotion render` 실행 시
 * Remotion이 이 파일을 번들링하여 Root 컴포넌트를 불러옵니다.
 *
 * remotion.config.ts 의 `Config.setEntryPoint('src/index.tsx')` 와 연결됩니다.
 */
import { registerRoot } from 'remotion';
import { RemotionRoot } from './animation/Root.js';

registerRoot(RemotionRoot);
