/**
 * Web Speech API 기반 한국어 TTS 서비스.
 *
 * - `speechSynthesis`를 싱글턴으로 래핑
 * - Chrome은 voice 목록이 비동기로 늦게 채워지므로 `loadVoices()`가 Promise로 기다림
 * - 한국어(ko-*) 음성을 우선 필터링해 목록 제공
 * - `speak({ text, rate, pitch, voice, onStart, onEnd, onError })`로 재생
 * - onStart 콜백을 통해 외부(avatarBus)와 재생 타이밍을 동기화할 수 있다
 *
 * 주의: speech rate와 viseme timeline speed는 같은 계수를 써야 체감 립싱크가 맞는다.
 *       단, 브라우저 TTS의 rate 해석은 일관되지 않으므로 완벽한 정렬은 기대하지 말 것.
 */

/**
 * 알려진 한국어 TTS 음성명에서 성별을 추론.
 * Web Speech API는 gender 필드를 제공하지 않으므로 이름 패턴 매칭이 최선이다.
 * 매칭되지 않으면 'unknown'.
 *
 * 참고 대상:
 * - Windows: Heami(F), SunHi(F)
 * - Edge/Azure Neural: SunHi/JiMin/SeoHyeon/YuJin(F), InJoon/BongJin/GookMin/Hyunsu(M)
 * - Apple: Yuna/Sora(F), Minsu(M)
 * - Google: "Google 한국의" + 여자/남자 표기
 */
export type VoiceGender = 'male' | 'female' | 'unknown';

export function inferVoiceGender(voice: SpeechSynthesisVoice): VoiceGender {
  const s = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  if (/injoon|bongjin|gookmin|hyunsu|minsu|\bmale\b|\bman\b|남자|남성/.test(s)) return 'male';
  if (/heami|sunhi|jimin|seohyeon|yujin|yuna|sora|\bfemale\b|\bwoman\b|여자|여성/.test(s)) return 'female';
  return 'unknown';
}

/**
 * 주어진 음성 목록에서 target 성별에 가장 잘 맞는 음성을 선택.
 * 1순위: target 성별로 확정된 음성
 * 2순위: 알 수 없는(unknown) 음성 — 어느 쪽이 기본인지 모르는 Google 등
 * 3순위: 반대 성별이라도 아무거나
 */
export function pickVoiceByGender(
  voices: readonly SpeechSynthesisVoice[],
  target: 'male' | 'female',
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const matched = voices.find((v) => inferVoiceGender(v) === target);
  if (matched) return matched;
  const unknown = voices.find((v) => inferVoiceGender(v) === 'unknown');
  if (unknown) return unknown;
  return voices[0] ?? null;
}

export interface SpeakOptions {
  readonly text: string;
  /** 0.1 ~ 10. 기본 1.0. */
  readonly rate?: number;
  /** 0 ~ 2. 기본 1.0. */
  readonly pitch?: number;
  /** 선택된 SpeechSynthesisVoice. 미지정 시 한국어 기본 음성 자동 선택. */
  readonly voice?: SpeechSynthesisVoice | null;
  readonly onStart?: () => void;
  readonly onEnd?: () => void;
  readonly onError?: (err: string) => void;
}

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  return window.speechSynthesis ?? null;
}

export const ttsService = {
  isSupported(): boolean {
    return getSynth() !== null;
  },

  /**
   * 사용 가능한 음성 목록을 비동기로 로드.
   * Chrome은 첫 호출 시 voice 배열이 비어있다가 `voiceschanged` 이벤트 이후 채워진다.
   */
  async loadVoices(): Promise<SpeechSynthesisVoice[]> {
    const synth = getSynth();
    if (!synth) return [];
    const existing = synth.getVoices();
    if (existing.length > 0) return existing;
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        synth.removeEventListener('voiceschanged', onChange);
        resolve(synth.getVoices());
      };
      const onChange = () => done();
      synth.addEventListener('voiceschanged', onChange);
      // Safari 등은 이벤트를 쏘지 않기도 함 → 타임아웃 안전장치
      window.setTimeout(done, 1500);
    });
  },

  /** 한국어(`ko-KR`, `ko`) 음성만 필터. */
  async loadKoreanVoices(): Promise<SpeechSynthesisVoice[]> {
    const all = await this.loadVoices();
    return all.filter((v) => /^ko(-|$)/i.test(v.lang));
  },

  /**
   * 발화 시작. 내부적으로 진행 중인 발화는 먼저 취소한다.
   * 한국어 음성이 있으면 자동 선택하고, 없으면 브라우저 기본 ko-KR 힌트로 맡긴다.
   */
  speak(opts: SpeakOptions): void {
    const synth = getSynth();
    if (!synth) {
      opts.onError?.('SpeechSynthesis API not supported');
      return;
    }
    synth.cancel();

    const utter = new SpeechSynthesisUtterance(opts.text);
    utter.lang = opts.voice?.lang ?? 'ko-KR';
    if (opts.voice) utter.voice = opts.voice;
    utter.rate = opts.rate ?? 1.0;
    utter.pitch = opts.pitch ?? 1.0;

    utter.onstart = () => opts.onStart?.();
    utter.onend = () => opts.onEnd?.();
    utter.onerror = (e: SpeechSynthesisErrorEvent) => {
      // 'canceled'는 stop()/재발화로 발생하는 정상 종료이므로 에러로 보고하지 않는다.
      if (e.error === 'canceled' || e.error === 'interrupted') {
        opts.onEnd?.();
        return;
      }
      opts.onError?.(e.error || 'unknown');
    };

    synth.speak(utter);
  },

  stop(): void {
    getSynth()?.cancel();
  },
};
