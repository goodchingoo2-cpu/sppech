/**
 * 시선/깜빡임 컨트롤러.
 *
 * 자연스러움의 핵심:
 *   1. 주기적 깜빡임 (평균 3~6초, 한 번당 120~180ms)
 *   2. 미세한 눈동자 움직임 (향후 LookAt 방식으로 확장 가능)
 *
 * 이 구현은 MorphController의 'blink' 레이어를 제어한다.
 */

import type { MorphController } from './MorphController.js';
import type { BlendshapeWeights } from './visemeBlendshapes.js';

const BLINK_NAMES: readonly string[] = ['eyeBlinkLeft', 'eyeBlinkRight'];

export interface GazeOptions {
  /** 평균 깜빡임 간격 (ms). 기본 4000. */
  readonly avgBlinkIntervalMs?: number;
  /** 간격의 랜덤 지터 범위 (+/- ms). 기본 1500. */
  readonly blinkIntervalJitterMs?: number;
  /** 깜빡임 한 번 전체 시간 (ms). 기본 150. */
  readonly blinkDurationMs?: number;
}

export class GazeController {
  private readonly controller: MorphController;
  private readonly avg: number;
  private readonly jitter: number;
  private readonly dur: number;

  private nextBlinkAt: number;
  private blinkStartAt: number | null = null;

  constructor(controller: MorphController, options: GazeOptions = {}) {
    this.controller = controller;
    this.avg = options.avgBlinkIntervalMs ?? 4000;
    this.jitter = options.blinkIntervalJitterMs ?? 1500;
    this.dur = options.blinkDurationMs ?? 150;
    this.nextBlinkAt = this.avg;
    this.controller.registerManagedNames(BLINK_NAMES);
  }

  tick(nowMs: number): void {
    // 깜빡임 상태 업데이트
    if (this.blinkStartAt === null && nowMs >= this.nextBlinkAt) {
      this.blinkStartAt = nowMs;
    }
    if (this.blinkStartAt !== null) {
      const t = (nowMs - this.blinkStartAt) / this.dur; // 0 → 1
      if (t >= 1) {
        this.blinkStartAt = null;
        this.nextBlinkAt = nowMs + this.avg + (Math.random() - 0.5) * 2 * this.jitter;
        this.controller.setLayer('blink', {});
      } else {
        // 0→1 구간을 up-down 곡선으로: sin(pi * t)
        const w = Math.sin(Math.PI * t);
        const layer: BlendshapeWeights = {
          eyeBlinkLeft: w,
          eyeBlinkRight: w,
        };
        this.controller.setLayer('blink', layer);
      }
    }
  }

  /** 즉시 한 번 깜빡이게 스케줄 (디버그/테스트용). */
  triggerBlinkNow(nowMs: number): void {
    this.nextBlinkAt = nowMs;
  }
}
