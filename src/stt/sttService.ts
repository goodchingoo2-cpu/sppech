/**
 * 한국어 음성 인식(STT) 래퍼.
 *
 * Web Speech API의 SpeechRecognition을 콜백 기반으로 추상화한다.
 * - Chrome/Edge는 `webkitSpeechRecognition`으로 제공됨 (실제로는 Google STT 호출)
 * - Firefox/Safari 미지원 → isSupported() 로 체크해 폴백(키보드 입력) 유도
 * - `interimResults=true`로 입모양 피드백용 interim 콜백 제공
 *
 * 한 번의 `listen()`은 한 번의 발화(final 결과 1회)만 처리하고 종료한다 (continuous=false).
 * 반환되는 함수로 중도 취소 가능.
 */

// Chrome/Edge는 prefix 버전만 있고, 표준 버전은 타입만 존재한다.
type RecCtor = new () => SpeechRecognition;

function getCtor(): RecCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecCtor;
    webkitSpeechRecognition?: RecCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface SttListenOptions {
  /** 중간(확정 전) 인식 결과. UI에 실시간 자막용. */
  readonly onInterim?: (text: string) => void;
  /** 최종 확정 결과. confidence 0.0~1.0. */
  readonly onFinal: (text: string, confidence: number) => void;
  /** 에러 코드 — 'no-speech', 'audio-capture', 'not-allowed', 'network' 등. */
  readonly onError?: (err: string) => void;
  /** 세션 종료(성공·실패 무관). */
  readonly onEnd?: () => void;
}

export const sttService = {
  isSupported(): boolean {
    return getCtor() !== null;
  },

  /**
   * 마이크 듣기 1회 시작.
   * 반환값은 취소 함수 — 호출하면 진행 중인 인식을 중단한다.
   */
  listen(opts: SttListenOptions): () => void {
    const Ctor = getCtor();
    if (!Ctor) {
      opts.onError?.('not-supported');
      opts.onEnd?.();
      return () => {};
    }

    const rec = new Ctor();
    rec.lang = 'ko-KR';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results.item(i);
        if (!r) continue;
        const alt = r.item(0);
        if (!alt) continue;
        if (r.isFinal) {
          opts.onFinal(alt.transcript.trim(), alt.confidence);
        } else {
          opts.onInterim?.(alt.transcript);
        }
      }
    };
    rec.onerror = (e: Event) => {
      const err = (e as SpeechRecognitionErrorEvent).error ?? 'unknown';
      // 'aborted'는 사용자가 의도적으로 stop()한 경우로, 에러로 보고하지 않는다.
      if (err !== 'aborted') opts.onError?.(err);
    };
    rec.onend = () => {
      opts.onEnd?.();
    };

    try {
      rec.start();
    } catch (e) {
      opts.onError?.(`start-failed: ${String(e)}`);
      opts.onEnd?.();
    }

    return () => {
      try {
        rec.stop();
      } catch {
        /* 이미 종료됨 */
      }
    };
  },
};
