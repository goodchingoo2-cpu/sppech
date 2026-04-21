/**
 * 블렌드셰이프(morph target) 제어기.
 *
 * 책임:
 *   - 3D 모델의 여러 메시에 흩어진 동일 이름 블렌드셰이프를 한꺼번에 제어.
 *   - 타겟 가중치 집합을 받고, 프레임마다 현재 가중치를 타겟으로 지수 보간.
 *   - 비즈메 가중치와 표정/깜빡임 가중치를 분리 레이어로 합성.
 *
 * 설계:
 *   - Three.js 의존을 최소화하기 위해 "메시 어댑터" 인터페이스만 받는다.
 *   - 이렇게 하면 jsdom 없이 테스트 가능 + Remotion/WebXR 등에도 재사용.
 */

import { USED_BLENDSHAPE_NAMES, VISEME_TO_BLENDSHAPES } from './visemeBlendshapes.js';
import type { Viseme } from '../viseme/visemeMap.js';

/**
 * 이름 기반 블렌드셰이프 접근을 제공하는 어댑터.
 * Three.js Mesh의 morphTargetDictionary/morphTargetInfluences를 래핑한다.
 */
export interface MorphTargetAdapter {
  /** 지원하는 블렌드셰이프 이름 목록. */
  readonly names: readonly string[];
  /** 현재 가중치 읽기. 없는 이름이면 0 반환 허용. */
  get(name: string): number;
  /** 가중치 쓰기. 없는 이름이면 무시. */
  set(name: string, value: number): void;
}

/** 레이어. 동일 이름이 여러 레이어에 있으면 가중치는 "최대값"으로 합성된다. */
export type Layer = 'viseme' | 'expression' | 'blink';

export interface MorphControllerOptions {
  /**
   * 보간 감쇠율. 1프레임에 타겟과의 차이 중 몇 %를 줄일지.
   * 0.2 = 매 프레임 20%씩 타겟 쪽으로 이동 (일반적 립싱크용 권장값).
   */
  readonly smoothing?: number;
}

export class MorphController {
  private readonly adapters: MorphTargetAdapter[];
  private readonly smoothing: number;
  private readonly targetsByLayer: Map<Layer, Map<string, number>> = new Map();
  /** 실제로 매 프레임 쓰기를 수행하는 이름 집합. */
  private readonly managedNames: Set<string>;

  constructor(adapters: MorphTargetAdapter[], options: MorphControllerOptions = {}) {
    this.adapters = adapters;
    this.smoothing = options.smoothing ?? 0.25;
    if (this.smoothing <= 0 || this.smoothing > 1) {
      throw new Error(`smoothing must be in (0, 1]; got ${this.smoothing}`);
    }
    // 제어 대상 = 비즈메에서 사용하는 이름 + (추후) 표정/깜빡임 추가분
    this.managedNames = new Set(USED_BLENDSHAPE_NAMES);
  }

  /** 레이어에서 추가로 관리할 이름을 등록 (표정/깜빡임 등). */
  registerManagedNames(names: readonly string[]): void {
    for (const n of names) this.managedNames.add(n);
  }

  /** 특정 레이어의 타겟을 갱신. 기존 타겟을 덮어쓴다 (null/undefined 값은 0으로 간주). */
  setLayer(layer: Layer, weights: Readonly<Record<string, number>>): void {
    const map = new Map<string, number>();
    for (const [name, value] of Object.entries(weights)) {
      map.set(name, clamp01(value));
    }
    this.targetsByLayer.set(layer, map);
  }

  setViseme(viseme: Viseme, intensity = 1.0): void {
    const base = VISEME_TO_BLENDSHAPES[viseme];
    if (intensity === 1.0) {
      this.setLayer('viseme', base);
      return;
    }
    const scaled: Record<string, number> = {};
    for (const [n, v] of Object.entries(base)) scaled[n] = v * clamp01(intensity);
    this.setLayer('viseme', scaled);
  }

  clearLayer(layer: Layer): void {
    this.targetsByLayer.delete(layer);
  }

  /**
   * 모든 레이어의 타겟을 합성하여 "현재 프레임의 최종 타겟" 맵을 만든다.
   * 합성 규칙: 동일 이름은 레이어 간 max (겹치는 표정과 립싱크가 서로 덮어쓰지 않도록).
   */
  computeTargets(): Map<string, number> {
    const result = new Map<string, number>();
    for (const layer of this.targetsByLayer.values()) {
      for (const [name, value] of layer) {
        const prev = result.get(name) ?? 0;
        if (value > prev) result.set(name, value);
      }
    }
    // 관리 대상이지만 어느 레이어에도 없는 이름은 타겟 0
    for (const name of this.managedNames) {
      if (!result.has(name)) result.set(name, 0);
    }
    return result;
  }

  /**
   * 한 프레임 진행. 현재 → 타겟 방향으로 smoothing만큼 이동시킨다.
   * deltaMs를 받아 프레임레이트 독립적인 감쇠를 계산.
   */
  tick(deltaMs: number = 16.67): void {
    const targets = this.computeTargets();
    // 프레임 독립 감쇠: k = 1 - (1 - smoothing)^(delta/16.67)
    const ratio = deltaMs / 16.67;
    const k = 1 - Math.pow(1 - this.smoothing, ratio);
    for (const [name, target] of targets) {
      for (const ad of this.adapters) {
        if (!ad.names.includes(name)) continue;
        const cur = ad.get(name);
        const next = cur + (target - cur) * k;
        ad.set(name, next);
      }
    }
  }

  /** 모든 어댑터의 관리 대상 가중치를 즉시 0으로 (초기화). */
  reset(): void {
    for (const name of this.managedNames) {
      for (const ad of this.adapters) {
        if (ad.names.includes(name)) ad.set(name, 0);
      }
    }
    this.targetsByLayer.clear();
  }
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
