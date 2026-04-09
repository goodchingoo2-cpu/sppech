import React from 'react';
import { Composition } from 'remotion';
import { FaceAnimation } from './FaceAnimation.js';
import type { FaceAnimationProps } from './FaceAnimation.js';
import { MouthCloseup } from './MouthCloseup.js';
import type { MouthCloseupProps } from './MouthCloseup.js';
import type { RemotionFrameData } from '../input/types.js';

// ── 기본 더미 frameData (Remotion Studio 미리보기용) ──────────
const DUMMY_FRAME_DATA: RemotionFrameData[] = Array.from({ length: 150 }, (_, i) => ({
  frameIndex: i,
  lipModel: 'L6',
  tongueModel: 'T6',
  lipWeight: 0,
  tongueWeight: 0,
}));

// ── Root: Remotion Composition 등록 ──────────────────────────
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/*
        FaceAnimation Composition
        - id       : 렌더링 시 --composition 옵션에 사용
        - fps      : 30fps (기본값)
        - width/height : 1280×720 HD
        - durationInFrames: 기본 5초(150 프레임); CLI 렌더링 시 실제 길이로 덮어씀
        - defaultProps : Remotion Studio에서 미리보기할 때 사용되는 더미 데이터
      */}
      <Composition<any, FaceAnimationProps>
        id="FaceAnimation"
        component={FaceAnimation}
        fps={30}
        width={1280}
        height={720}
        durationInFrames={150}
        defaultProps={{ frameData: DUMMY_FRAME_DATA }}
      />
      <Composition<any, MouthCloseupProps>
        id="MouthCloseup"
        component={MouthCloseup}
        fps={30}
        width={1280}
        height={720}
        durationInFrames={150}
        defaultProps={{ frameData: DUMMY_FRAME_DATA }}
      />
    </>
  );
};
