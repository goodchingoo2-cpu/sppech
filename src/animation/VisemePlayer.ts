/**
 * 비즈메 타임라인 재생기.
 *
 * 책임:
 *   - VisemeFrame[] (startMs/endMs)을 받아 재생 시작.
 *   - 매 tick마다 현재 시간에 해당하는 비즈메를 MorphController에 주입.
 *   - 프레임 경계에서 부드러운 전환을 위해 cross-fade intensity를 계산.
 *
 * 시간원(clock source)은 외부에서 제공 (ms 단위). TTS의 currentTime과 동기 가능.
 */

import type { MorphController } from './MorphController.js';
import type { VisemeFrame } from '../viseme/timeline.js';

export interface VisemePlayerOptions {
  /** 프레임 간 cross-fade 시간 (ms). 기본 40. */
  readonly crossfadeMs?: number;
}

export class VisemePlayer {
  private timeline: readonly VisemeFrame[] = [];
  private readonly controller: MorphController;
  private readonly crossfadeMs: number;
  private playing = false;
  private startedAt = 0;
  private lastIndex = -1;

  constructor(controller: MorphController, options: VisemePlayerOptions = {}) {
    this.controller = controller;
    this.crossfadeMs = options.crossfadeMs ?? 40;
  }

  /** 타임라인을 재생 시작. startedAt은 외부 clock의 "지금" 시각(ms). */
  play(timeline: readonly VisemeFrame[], startedAt: number): void {
    this.timeline = timeline;
    this.startedAt = startedAt;
    this.lastIndex = -1;
    this.playing = true;
  }

  stop(): void {
    this.playing = false;
    this.controller.clearLayer('viseme');
  }

  isPlaying(): boolean {
    return this.playing;
  }

  /**
   * 외부 clock의 현재 시각 + 프레임 deltaMs를 받아 1프레임 진행.
   * 재생 중이 아니어도 tick은 호출해야 MorphController가 관성 보간을 이어감.
   */
  tick(nowMs: number, deltaMs: number): void {
    if (this.playing) this.updateVisemeLayer(nowMs);
    this.controller.tick(deltaMs);
    // 끝에 도달했으면 정지
    if (this.playing && this.timeline.length > 0) {
      const end = this.timeline[this.timeline.length - 1]!.endMs;
      if (nowMs - this.startedAt > end) this.stop();
    }
  }

  private findIndex(localMs: number): number {
    // 선형 탐색도 충분히 빠르지만, 단조 증가를 이용해 lastIndex부터 앞으로만 본다.
    const tl = this.timeline;
    let i = Math.max(0, this.lastIndex);
    while (i < tl.length && tl[i]!.endMs <= localMs) i++;
    if (i >= tl.length) return -1;
    return i;
  }

  private updateVisemeLayer(nowMs: number): void {
    const local = nowMs - this.startedAt;
    if (local < 0) return;

    const idx = this.findIndex(local);
    if (idx < 0) return;
    this.lastIndex = idx;

    const cur = this.timeline[idx]!;
    const next = this.timeline[idx + 1];

    // 프레임 말미에 들어가면 다음 비즈메로 cross-fade.
    const toEnd = cur.endMs - local;
    if (next && toEnd < this.crossfadeMs) {
      const t = 1 - toEnd / this.crossfadeMs; // 0→1
      this.controller.setViseme(next.viseme, t);
      // 현재 비즈메를 1-t로 겹쳐 주지 않고, MorphController의 관성 보간이 자연스러운 전환을 만든다.
      return;
    }
    this.controller.setViseme(cur.viseme, 1.0);
  }
}
