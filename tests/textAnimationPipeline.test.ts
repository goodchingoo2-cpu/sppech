import { describe, expect, it } from 'vitest';
import { buildTextAnimationData } from '../src/server/textAnimationPipeline.js';

describe('buildTextAnimationData()', () => {
  it('같은 입력 텍스트에 대해 목표 duration이 주어지면 전체 길이를 그에 맞게 보정한다', () => {
    const text = '안녕하세요';

    const baseline = buildTextAnimationData(text, {
      rate: 'normal',
      fps: 30,
    });
    const retimed = buildTextAnimationData(text, {
      rate: 'normal',
      fps: 30,
      targetDurationSec: baseline.durationSec * 1.5,
    });

    expect(retimed.durationSec).toBeGreaterThan(baseline.durationSec);
    expect(retimed.frames.length).toBeGreaterThan(baseline.frames.length);
  });

  it('공용 텍스트 파이프라인은 프레임과 G2P 완료 토큰을 함께 반환한다', () => {
    const result = buildTextAnimationData('우유', {
      rate: 'normal',
      fps: 30,
    });

    expect(result.tokens.length).toBeGreaterThan(0);
    expect(result.frames.length).toBeGreaterThan(0);
    expect(result.fps).toBe(30);
  });
});
