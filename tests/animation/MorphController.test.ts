import { describe, it, expect } from 'vitest';
import { MorphController, type MorphTargetAdapter } from '../../src/animation/MorphController.js';
import { USED_BLENDSHAPE_NAMES, VISEME_TO_BLENDSHAPES } from '../../src/animation/visemeBlendshapes.js';

/** 테스트용 인메모리 어댑터. */
function makeAdapter(names: readonly string[] = USED_BLENDSHAPE_NAMES): MorphTargetAdapter & { values: Map<string, number> } {
  const values = new Map<string, number>(names.map((n) => [n, 0]));
  return {
    names,
    values,
    get(name) { return values.get(name) ?? 0; },
    set(name, value) { if (values.has(name)) values.set(name, value); },
  };
}

describe('MorphController', () => {
  it('setViseme + tick이 관련 블렌드셰이프를 타겟 쪽으로 움직인다', () => {
    const ad = makeAdapter();
    const ctrl = new MorphController([ad], { smoothing: 0.5 });
    ctrl.setViseme('V_A');
    ctrl.tick(16.67);
    // 0.5 보간이므로 타겟의 약 절반에 도달
    expect(ad.get('jawOpen')).toBeCloseTo(VISEME_TO_BLENDSHAPES.V_A.jawOpen! * 0.5, 5);
  });

  it('여러 번 tick하면 타겟에 수렴', () => {
    const ad = makeAdapter();
    const ctrl = new MorphController([ad], { smoothing: 0.5 });
    ctrl.setViseme('V_O');
    for (let i = 0; i < 20; i++) ctrl.tick(16.67);
    expect(ad.get('jawOpen')).toBeCloseTo(VISEME_TO_BLENDSHAPES.V_O.jawOpen!, 3);
    expect(ad.get('mouthFunnel')).toBeCloseTo(VISEME_TO_BLENDSHAPES.V_O.mouthFunnel!, 3);
  });

  it('비즈메 전환 시 이전 가중치는 0으로 되돌아감', () => {
    const ad = makeAdapter();
    const ctrl = new MorphController([ad], { smoothing: 0.9 });
    ctrl.setViseme('V_O');
    for (let i = 0; i < 30; i++) ctrl.tick(16.67);
    expect(ad.get('mouthFunnel')).toBeGreaterThan(0.5);
    // V_A로 전환하면 mouthFunnel은 V_A에 없으므로 타겟 0
    ctrl.setViseme('V_A');
    for (let i = 0; i < 30; i++) ctrl.tick(16.67);
    expect(ad.get('mouthFunnel')).toBeLessThan(0.01);
    expect(ad.get('jawOpen')).toBeCloseTo(VISEME_TO_BLENDSHAPES.V_A.jawOpen!, 2);
  });

  it('레이어 합성: viseme과 expression이 동일 이름일 때 max 적용', () => {
    const ad = makeAdapter();
    const ctrl = new MorphController([ad], { smoothing: 0.95 });
    ctrl.setLayer('viseme', { mouthSmileLeft: 0.2 });
    ctrl.setLayer('expression', { mouthSmileLeft: 0.7 });
    for (let i = 0; i < 10; i++) ctrl.tick(16.67);
    expect(ad.get('mouthSmileLeft')).toBeCloseTo(0.7, 2);
  });

  it('intensity < 1이면 스케일 적용', () => {
    const ad = makeAdapter();
    const ctrl = new MorphController([ad], { smoothing: 0.95 });
    ctrl.setViseme('V_A', 0.5);
    for (let i = 0; i < 20; i++) ctrl.tick(16.67);
    expect(ad.get('jawOpen')).toBeCloseTo(VISEME_TO_BLENDSHAPES.V_A.jawOpen! * 0.5, 2);
  });

  it('reset()은 모든 관리 대상을 0으로', () => {
    const ad = makeAdapter();
    const ctrl = new MorphController([ad], { smoothing: 0.95 });
    ctrl.setViseme('V_O');
    for (let i = 0; i < 10; i++) ctrl.tick(16.67);
    expect(ad.get('mouthFunnel')).toBeGreaterThan(0.1);
    ctrl.reset();
    expect(ad.get('mouthFunnel')).toBe(0);
    expect(ad.get('jawOpen')).toBe(0);
  });

  it('어댑터가 가진 이름만 쓰기 (없는 이름은 무시)', () => {
    const ad = makeAdapter(['jawOpen']); // 일부만 지원
    const ctrl = new MorphController([ad], { smoothing: 0.95 });
    ctrl.setViseme('V_O'); // jawOpen, mouthFunnel, mouthPucker 포함
    expect(() => {
      for (let i = 0; i < 5; i++) ctrl.tick(16.67);
    }).not.toThrow();
    expect(ad.get('jawOpen')).toBeGreaterThan(0);
  });

  it('smoothing이 유효 범위를 벗어나면 예외', () => {
    expect(() => new MorphController([], { smoothing: 0 })).toThrow();
    expect(() => new MorphController([], { smoothing: 1.5 })).toThrow();
  });

  it('가중치는 [0,1]로 클램프 (NaN, 음수, 초과)', () => {
    const ad = makeAdapter();
    const ctrl = new MorphController([ad], { smoothing: 0.95 });
    ctrl.setLayer('viseme', { jawOpen: NaN, mouthFunnel: -0.5, mouthPucker: 2 });
    for (let i = 0; i < 20; i++) ctrl.tick(16.67);
    expect(ad.get('jawOpen')).toBe(0);
    expect(ad.get('mouthFunnel')).toBe(0);
    expect(ad.get('mouthPucker')).toBeCloseTo(1, 2);
  });

  it('deltaMs를 늘리면 더 큰 변화 (프레임 독립)', () => {
    const ad1 = makeAdapter();
    const ad2 = makeAdapter();
    const ctrl1 = new MorphController([ad1], { smoothing: 0.2 });
    const ctrl2 = new MorphController([ad2], { smoothing: 0.2 });
    ctrl1.setViseme('V_A');
    ctrl2.setViseme('V_A');
    ctrl1.tick(16.67);
    ctrl2.tick(33.33);
    expect(ad2.get('jawOpen')).toBeGreaterThan(ad1.get('jawOpen'));
  });
});
