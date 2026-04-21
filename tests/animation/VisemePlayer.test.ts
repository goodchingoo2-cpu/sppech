import { describe, it, expect } from 'vitest';
import { MorphController, type MorphTargetAdapter } from '../../src/animation/MorphController.js';
import { VisemePlayer } from '../../src/animation/VisemePlayer.js';
import { USED_BLENDSHAPE_NAMES } from '../../src/animation/visemeBlendshapes.js';
import type { VisemeFrame } from '../../src/viseme/timeline.js';

function makeAdapter(): MorphTargetAdapter {
  const values = new Map<string, number>(USED_BLENDSHAPE_NAMES.map((n) => [n, 0]));
  return {
    names: USED_BLENDSHAPE_NAMES,
    get(name) { return values.get(name) ?? 0; },
    set(name, value) { values.set(name, value); },
  };
}

describe('VisemePlayer', () => {
  const TL: VisemeFrame[] = [
    { viseme: 'V_REST', startMs: 0,   endMs: 100 },
    { viseme: 'V_A',    startMs: 100, endMs: 300 },
    { viseme: 'V_M',    startMs: 300, endMs: 400 },
    { viseme: 'V_REST', startMs: 400, endMs: 500 },
  ];

  it('시작 전에는 isPlaying=false', () => {
    const ctrl = new MorphController([makeAdapter()], { smoothing: 0.9 });
    const p = new VisemePlayer(ctrl);
    expect(p.isPlaying()).toBe(false);
  });

  it('play 후 tick으로 진행, 끝나면 stop', () => {
    const ad = makeAdapter();
    const ctrl = new MorphController([ad], { smoothing: 0.9 });
    const p = new VisemePlayer(ctrl, { crossfadeMs: 20 });
    p.play(TL, 1000);
    expect(p.isPlaying()).toBe(true);

    // 200ms 시점 = V_A 중간
    for (let t = 1000; t < 1200; t += 16) p.tick(t, 16);
    expect(ad.get('jawOpen')).toBeGreaterThan(0.2);

    // 타임라인 끝을 지나면 stop
    for (let t = 1200; t < 1600; t += 16) p.tick(t, 16);
    expect(p.isPlaying()).toBe(false);
  });

  it('stop 호출 시 viseme 레이어가 정리되어 가중치가 0으로 수렴', () => {
    const ad = makeAdapter();
    const ctrl = new MorphController([ad], { smoothing: 0.9 });
    const p = new VisemePlayer(ctrl);
    p.play(TL, 0);
    for (let t = 100; t < 250; t += 16) p.tick(t, 16);
    expect(ad.get('jawOpen')).toBeGreaterThan(0.1);
    p.stop();
    for (let t = 250; t < 400; t += 16) p.tick(t, 16);
    expect(ad.get('jawOpen')).toBeLessThan(0.05);
  });

  it('시작 이전(local<0) 입력은 무시', () => {
    const ad = makeAdapter();
    const ctrl = new MorphController([ad], { smoothing: 0.9 });
    const p = new VisemePlayer(ctrl);
    p.play(TL, 1000);
    expect(() => p.tick(500, 16)).not.toThrow();
    expect(ad.get('jawOpen')).toBe(0);
  });
});
