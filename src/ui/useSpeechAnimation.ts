// ============================================================
// Web Speech API + 애니메이션 동기화 훅
// ============================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import type { RemotionFrameData } from '../input/types.js';

export type AnimationStatus = 'idle' | 'loading' | 'speaking' | 'done' | 'error';

export interface SpeechAnimationState {
  status: AnimationStatus;
  currentFrame: RemotionFrameData | null;
  frames: RemotionFrameData[];
  error: string | null;
}

export interface UseSpeechAnimationReturn extends SpeechAnimationState {
  speak: (text: string, rate?: 'slow' | 'normal' | 'fast') => Promise<void>;
  stop: () => void;
}

const FPS = 30;

/** 발화 속도 → SpeechSynthesis rate 매핑 */
const SPEECH_RATE: Record<string, number> = {
  slow: 0.75,
  normal: 1.0,
  fast: 1.4,
};

export function useSpeechAnimation(): UseSpeechAnimationReturn {
  const [status, setStatus] = useState<AnimationStatus>('idle');
  const [currentFrame, setCurrentFrame] = useState<RemotionFrameData | null>(null);
  const [frames, setFrames] = useState<RemotionFrameData[]>([]);
  const [error, setError] = useState<string | null>(null);

  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const framesRef = useRef<RemotionFrameData[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // 애니메이션 루프 — 프레임 간 선형 보간으로 자연스러운 움직임
  const animate = useCallback((timestamp: number) => {
    const frames = framesRef.current;
    if (!frames.length) return;

    // elapsed 음수 방지 (onstart 직후 rAF 타이밍 차이로 발생 가능)
    const elapsed   = Math.max(0, (timestamp - startTimeRef.current) / 1000);
    const exactFrame = elapsed * FPS;
    const frameIdx  = Math.min(Math.floor(exactFrame), frames.length - 1);
    const nextIdx   = Math.min(frameIdx + 1, frames.length - 1);
    const t         = exactFrame - frameIdx; // 0~1: 현재 프레임 내 진행도

    const cur  = frames[frameIdx];
    const next = frames[nextIdx];

    // weight만 선형 보간 (blendModel 미사용 — 두 형태 동시 렌더링 시 중복 이미지 발생)
    // lipModel 전환은 1프레임(1/30초) 내 순간 전환으로 처리 (시각적으로 무방)
    const interpolated: RemotionFrameData = {
      ...cur,
      lipWeight:    cur.lipWeight    * (1 - t) + next.lipWeight    * t,
      tongueWeight: cur.tongueWeight * (1 - t) + next.tongueWeight * t,
      blendModel:   undefined,
      blendWeight:  undefined,
    };

    setCurrentFrame(interpolated);

    if (frameIdx < frames.length - 1) {
      rafRef.current = requestAnimationFrame(animate);
    } else {
      setStatus('done');
    }
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (utteranceRef.current) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    }
    setStatus('idle');
    setCurrentFrame(null);
  }, []);

  const speak = useCallback(async (
    text: string,
    rate: 'slow' | 'normal' | 'fast' = 'normal',
  ) => {
    stop();
    setError(null);
    setStatus('loading');

    // 1. API에서 프레임 데이터 가져오기
    let fetchedFrames: RemotionFrameData[];
    try {
      const res = await fetch('/api/animate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, rate }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? '서버 오류');
      }
      const data = await res.json() as { frames: RemotionFrameData[] };
      fetchedFrames = data.frames;
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
      setStatus('error');
      return;
    }

    framesRef.current = fetchedFrames;
    setFrames(fetchedFrames);
    setStatus('speaking');

    // 2. Web Speech API TTS 시작
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = SPEECH_RATE[rate] ?? 1.0;
    utteranceRef.current = utterance;

    utterance.onstart = () => {
      startTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(animate);
    };

    utterance.onend = () => {
      // rAF가 완료될 때까지 대기 (animate 루프가 done 설정)
    };

    utterance.onerror = (ev) => {
      if (ev.error !== 'interrupted') {
        setError(`TTS 오류: ${ev.error}`);
        setStatus('error');
      }
    };

    window.speechSynthesis.speak(utterance);
  }, [animate, stop]);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { status, currentFrame, frames, error, speak, stop };
}
