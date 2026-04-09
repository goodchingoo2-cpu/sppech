import { Config } from '@remotion/cli/config';

/**
 * Remotion 4.x 설정 파일
 * https://www.remotion.dev/docs/config
 */

// 진입점: registerRoot() 를 호출하는 파일
Config.setEntryPoint('src/index.tsx');

// 코덱: H.264 MP4 출력 (호환성 최대)
Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');

// 병렬 렌더링 스레드 (CPU 코어 수에 맞게 조정 가능)
Config.setConcurrency(4);

// 크로미움 무헤드 옵션 (CI 환경 호환)
Config.setChromiumOpenGlRenderer('angle');

// Node.js ESM 스타일 .js 임포트를 webpack이 .ts/.tsx 로 해석하도록 설정
Config.overrideWebpackConfig((config) => {
  return {
    ...config,
    resolve: {
      ...config.resolve,
      extensionAlias: {
        '.js': ['.tsx', '.ts', '.js'],
        '.mjs': ['.mts', '.mjs'],
      },
    },
  };
});
