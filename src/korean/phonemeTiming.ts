// ============================================================
// 음소별 평균 지속시간 테이블
// MFA 없이 텍스트 기반으로 타이밍을 생성할 때 사용
// ============================================================

import type { PhonemeToken, PhonemePosition } from '../input/types.js';

// ── 발화 속도 ────────────────────────────────────────────────

export type SpeechRate = 'slow' | 'normal' | 'fast';

const RATE_MULTIPLIER: Record<SpeechRate, number> = {
  slow: 1.4,
  normal: 1.0,
  fast: 0.75,
};

// ── 음소별 기본 지속시간 (밀리초, onset 기준) ───────────────

/** 모음별 기본 지속시간 (ms) */
const VOWEL_DURATION_MS: Record<string, number> = {
  'ㅏ': 120, 'ㅐ': 110, 'ㅑ': 130, 'ㅒ': 115, 'ㅓ': 115,
  'ㅔ': 110, 'ㅕ': 125, 'ㅖ': 115, 'ㅗ': 120, 'ㅘ': 140,
  'ㅙ': 135, 'ㅚ': 130, 'ㅛ': 125, 'ㅜ': 120, 'ㅝ': 135,
  'ㅞ': 130, 'ㅟ': 125, 'ㅠ': 125, 'ㅡ': 110, 'ㅢ': 120,
  'ㅣ': 100,
};

/** 자음별 기본 지속시간 (ms, onset 위치 기준) */
const CONSONANT_DURATION_MS: Record<string, number> = {
  'ㄱ': 60, 'ㄲ': 70, 'ㄴ': 65, 'ㄷ': 60, 'ㄸ': 70,
  'ㄹ': 70, 'ㅁ': 70, 'ㅂ': 60, 'ㅃ': 70, 'ㅅ': 80,
  'ㅆ': 90, 'ㅇ': 0,  'ㅈ': 70, 'ㅉ': 80, 'ㅊ': 80,
  'ㅋ': 70, 'ㅌ': 70, 'ㅍ': 70, 'ㅎ': 60,
};

/** coda 위치 배율 */
const CODA_FACTOR = 0.8;

/** pause 기본 지속시간 (ms) */
const PAUSE_DURATION_MS = 400;

/** 기본 intensity 값 */
const DEFAULT_INTENSITY: Record<'vowel' | 'consonant' | 'pause', number> = {
  vowel: 0.8,
  consonant: 0.5,
  pause: 0.0,
};

// ── 핵심 함수 ────────────────────────────────────────────────

/**
 * 단일 음소의 지속시간 반환 (초 단위)
 */
export function getPhonemeDuration(
  jamo: string,
  position: PhonemePosition,
  rate: SpeechRate = 'normal'
): number {
  let ms: number;

  if (position === 'pause') {
    ms = PAUSE_DURATION_MS;
  } else if (VOWEL_DURATION_MS[jamo] !== undefined) {
    ms = VOWEL_DURATION_MS[jamo];
  } else {
    const base = CONSONANT_DURATION_MS[jamo] ?? 60;
    ms = position === 'coda' ? base * CODA_FACTOR : base;
  }

  return (ms * RATE_MULTIPLIER[rate]) / 1000;
}

/**
 * PhonemeToken[]의 start/end/duration/intensity를 채워 반환
 *
 * 입력 토큰은 jamo, position, isVowel, isPause, isDiphthong이 이미 설정된 상태.
 * 이중모음은 단일 토큰으로 처리 (반모음 구간 분리 없음).
 */
export function assignTimings(
  tokens: Array<Omit<PhonemeToken, 'start' | 'end' | 'duration' | 'intensity'>>,
  options: { rate?: SpeechRate; startTime?: number } = {}
): PhonemeToken[] {
  const rate = options.rate ?? 'normal';
  let cursor = options.startTime ?? 0;
  const result: PhonemeToken[] = [];

  for (const token of tokens) {
    const duration = getPhonemeDuration(token.jamo, token.position, rate);
    const start = cursor;
    const end = cursor + duration;

    let intensity: number;
    if (token.isPause) {
      intensity = DEFAULT_INTENSITY.pause;
    } else if (token.isVowel) {
      intensity = DEFAULT_INTENSITY.vowel;
    } else {
      intensity = DEFAULT_INTENSITY.consonant;
    }

    result.push({ ...token, start, end, duration, intensity });
    cursor = end;
  }

  return result;
}

/**
 * 생성된 타이밍을 목표 전체 duration에 맞춰 비례 재배치
 *
 * 텍스트 기반 기본 타이밍을 유지하되, TTS 결과의 실제 길이를 반영해
 * 전체 리듬을 실제 발화에 가깝게 보정할 때 사용한다.
 */
export function retimeToDuration(
  tokens: PhonemeToken[],
  targetDuration: number
): PhonemeToken[] {
  if (tokens.length === 0 || targetDuration <= 0) return tokens;

  const currentDuration = tokens[tokens.length - 1].end - tokens[0].start;
  if (currentDuration <= 0) return tokens;

  const scale = targetDuration / currentDuration;

  return tokens.map((token) => {
    const start = token.start * scale;
    const end = token.end * scale;
    return {
      ...token,
      start,
      end,
      duration: end - start,
    };
  });
}
