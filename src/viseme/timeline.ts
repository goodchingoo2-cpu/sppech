/**
 * 텍스트 → 비즈메 타임라인 생성기.
 *
 * 입력: 원문 문자열
 * 출력: VisemeFrame[] (start/end ms가 부여된 시퀀스)
 *
 * 파이프라인:
 *   tokenize → applyPronunciationRules → 음절별 [onset, nucleus?, coda?] 음소열
 *           → phonemeToVisemes → 지속시간 부여 → 누적 합산
 *
 * 지속시간 기본값 (speed=1.0):
 *   - 모음 단일: 180ms
 *   - 활음 모음(두 비즈메로 펼쳐짐): 각 100ms (합 200ms)
 *   - 자음: 80ms
 *   - 받침 연구개 비음(V_NG): 120ms (모음 꼬리에 붙는 느낌)
 *   - 공백/쉼표: 120ms (V_SIL)
 *   - 문장부호(./?!): 300ms (V_SIL)
 *   - 선두/후미 휴지: 200ms (V_REST)
 *
 * speed 계수는 모든 지속시간에 역수로 곱해진다 (0.7=느리게, 1.3=빠르게).
 */

import { tokenize, isSyllable, type Token, type Syllable } from '../korean/jamo.js';
import { applyPronunciationRules } from '../korean/dict.js';
import { syllableToPhonemes } from '../korean/phoneme.js';
import { phonemeToVisemes, type Viseme } from './visemeMap.js';

export interface VisemeFrame {
  readonly viseme: Viseme;
  readonly startMs: number;
  readonly endMs: number;
}

export interface TimelineOptions {
  /** 속도 계수. 1.0 = 기본, <1 = 느리게, >1 = 빠르게. */
  readonly speed?: number;
  /** 선두/후미 휴지 ms (기본 200). */
  readonly leadSilenceMs?: number;
}

const DUR = {
  vowelSimple: 180,
  vowelGlidePart: 100,
  consonant: 80,
  codaNg: 120,
  spaceSil: 120,
  sentenceSil: 300,
  restLead: 200,
} as const;

const SENTENCE_PUNCT = /[.!?…]/;

function visemeDuration(v: Viseme, isGlideVowel: boolean): number {
  switch (v) {
    case 'V_A': case 'V_EO': case 'V_O': case 'V_I':
      return isGlideVowel ? DUR.vowelGlidePart : DUR.vowelSimple;
    case 'V_M': case 'V_N': case 'V_K': case 'V_S':
      return DUR.consonant;
    case 'V_NG':
      return DUR.codaNg;
    case 'V_SIL':
      return DUR.spaceSil;
    case 'V_REST':
      return DUR.consonant; // 초성 ㅇ은 짧은 휴지
  }
}

function buildSyllableVisemes(s: Syllable): { viseme: Viseme; dur: number }[] {
  const out: { viseme: Viseme; dur: number }[] = [];
  const p = syllableToPhonemes(s);

  // 초성: 'ㅇ'(=> '_' => V_REST)는 실제로는 음가 없음 → 자음 프레임을 넣지 않는다.
  if (p.onset !== '_') {
    for (const v of phonemeToVisemes(p.onset)) {
      out.push({ viseme: v, dur: visemeDuration(v, false) });
    }
  }

  // 중성
  const nucVisemes = phonemeToVisemes(p.nucleus);
  const isGlide = nucVisemes.length > 1;
  for (const v of nucVisemes) {
    out.push({ viseme: v, dur: visemeDuration(v, isGlide) });
  }

  // 종성
  if (p.coda) {
    for (const v of phonemeToVisemes(p.coda)) {
      out.push({ viseme: v, dur: visemeDuration(v, false) });
    }
  }

  return out;
}

function nonSyllableVisemes(t: Token): { viseme: Viseme; dur: number }[] {
  if (isSyllable(t)) return [];
  if (t.kind === 'space') return [{ viseme: 'V_SIL', dur: DUR.spaceSil }];
  if (t.kind === 'punct') {
    const dur = SENTENCE_PUNCT.test(t.char) ? DUR.sentenceSil : DUR.spaceSil;
    return [{ viseme: 'V_SIL', dur }];
  }
  return []; // 'other'는 무시
}

/**
 * 인접한 동일 비즈메를 병합. 예: 연속 V_SIL은 하나로 합친다.
 */
function mergeAdjacent(frames: VisemeFrame[]): VisemeFrame[] {
  const out: VisemeFrame[] = [];
  for (const f of frames) {
    const last = out[out.length - 1];
    if (last && last.viseme === f.viseme) {
      out[out.length - 1] = { viseme: last.viseme, startMs: last.startMs, endMs: f.endMs };
    } else {
      out.push(f);
    }
  }
  return out;
}

export function generateTimeline(text: string, options: TimelineOptions = {}): VisemeFrame[] {
  const speed = options.speed ?? 1.0;
  if (speed <= 0) throw new Error('speed must be > 0');
  const lead = options.leadSilenceMs ?? DUR.restLead;

  const tokens = applyPronunciationRules(tokenize(text));

  const segments: { viseme: Viseme; dur: number }[] = [];
  segments.push({ viseme: 'V_REST', dur: lead });

  for (const t of tokens) {
    if (isSyllable(t)) {
      segments.push(...buildSyllableVisemes(t));
    } else {
      segments.push(...nonSyllableVisemes(t));
    }
  }

  segments.push({ viseme: 'V_REST', dur: lead });

  const frames: VisemeFrame[] = [];
  let cursor = 0;
  for (const seg of segments) {
    const scaled = Math.round(seg.dur / speed);
    frames.push({ viseme: seg.viseme, startMs: cursor, endMs: cursor + scaled });
    cursor += scaled;
  }

  return mergeAdjacent(frames);
}

/**
 * 실제 TTS 오디오 길이에 맞게 타임라인을 선형 스케일.
 * 앞뒤 V_REST를 유지한 채 본문 구간만 스케일한다.
 */
export function fitTimelineToAudio(
  frames: readonly VisemeFrame[],
  audioDurationMs: number,
): VisemeFrame[] {
  if (frames.length === 0) return [];
  const total = frames[frames.length - 1]!.endMs;
  if (total <= 0 || audioDurationMs <= 0) return frames.slice();
  const scale = audioDurationMs / total;
  return frames.map((f) => ({
    viseme: f.viseme,
    startMs: Math.round(f.startMs * scale),
    endMs: Math.round(f.endMs * scale),
  }));
}
