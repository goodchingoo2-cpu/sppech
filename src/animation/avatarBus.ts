/**
 * Avatar에 명령을 전달하는 경량 이벤트 버스.
 *
 * React 리렌더 없이도 즉시 명령이 전달되도록 모듈 싱글턴으로 둔다.
 * (props drilling 대신 사용. 간단한 사용 규모에선 context보다 간결.)
 */

import type { VisemeFrame } from '../viseme/timeline.js';
import type { ExpressionName } from './ExpressionPreset.js';

export interface AvatarListener {
  onPlay(frames: readonly VisemeFrame[]): void;
  onStop(): void;
  onSetExpression(name: ExpressionName): void;
}

class AvatarBus {
  private listeners = new Set<AvatarListener>();

  subscribe(l: AvatarListener): () => void {
    this.listeners.add(l);
    return () => { this.listeners.delete(l); };
  }

  play(frames: readonly VisemeFrame[]): void {
    for (const l of this.listeners) l.onPlay(frames);
  }
  stop(): void {
    for (const l of this.listeners) l.onStop();
  }
  setExpression(name: ExpressionName): void {
    for (const l of this.listeners) l.onSetExpression(name);
  }
}

export const avatarBus = new AvatarBus();
