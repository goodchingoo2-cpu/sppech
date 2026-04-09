// ============================================================
// MFA 정렬 데이터 파서
// MFA JSON (phones + words) → PhonemeToken[]
// ============================================================

import { readFileSync } from 'fs';
import type { PhonemeToken, MFAPhoneme, MFAWord, PhonemePosition } from './types.js';
import { isDiphthong } from '../korean/hangulDecomposer.js';

/** 묵음 pause를 나타내는 MFA 레이블 */
const PAUSE_LABELS = new Set(['', 'sp', 'sil', 'spn', '<eps>', 'SIL', 'SP']);

/**
 * MFA가 출력하는 phone label → 한글 자모 변환 테이블
 *
 * MFA 한국어 모델(korean_mfa)의 실제 레이블을 기준으로 작성.
 * 모델 버전에 따라 다를 수 있으므로 필요 시 수정하세요.
 */
const MFA_LABEL_TO_JAMO: Record<string, string> = {
  // 모음
  'a': 'ㅏ', 'e': 'ㅔ', 'eo': 'ㅓ', 'i': 'ㅣ',
  'o': 'ㅗ', 'u': 'ㅜ', 'eu': 'ㅡ', 'ae': 'ㅐ',
  'ya': 'ㅑ', 'yae': 'ㅒ', 'yeo': 'ㅕ', 'ye': 'ㅖ',
  'yo': 'ㅛ', 'yu': 'ㅠ', 'wa': 'ㅘ', 'wae': 'ㅙ',
  'oe': 'ㅚ', 'wo': 'ㅝ', 'we': 'ㅞ', 'wi': 'ㅟ',
  'ui': 'ㅢ',
  // 자음 — 평음
  'n': 'ㄴ', 'd': 'ㄷ', 'r': 'ㄹ', 'l': 'ㄹ',
  'm': 'ㅁ', 'b': 'ㅂ', 's': 'ㅅ', 'j': 'ㅈ',
  'g': 'ㄱ', 'k': 'ㅋ', 't': 'ㅌ', 'p': 'ㅍ',
  'ch': 'ㅊ', 'h': 'ㅎ', 'ng': 'ㅇ',
  // 자음 — 경음
  'ss': 'ㅆ', 'jj': 'ㅉ', 'dd': 'ㄸ', 'bb': 'ㅃ', 'gg': 'ㄲ',
  // 자음 — 격음
  'kh': 'ㅋ', 'th': 'ㅌ', 'ph': 'ㅍ', 'ch_a': 'ㅊ',
  // 직접 자모 입력 (이미 한글인 경우 그대로 통과)
  'ㄱ': 'ㄱ', 'ㄲ': 'ㄲ', 'ㄴ': 'ㄴ', 'ㄷ': 'ㄷ', 'ㄸ': 'ㄸ',
  'ㄹ': 'ㄹ', 'ㅁ': 'ㅁ', 'ㅂ': 'ㅂ', 'ㅃ': 'ㅃ', 'ㅅ': 'ㅅ',
  'ㅆ': 'ㅆ', 'ㅇ': 'ㅇ', 'ㅈ': 'ㅈ', 'ㅉ': 'ㅉ', 'ㅊ': 'ㅊ',
  'ㅋ': 'ㅋ', 'ㅌ': 'ㅌ', 'ㅍ': 'ㅍ', 'ㅎ': 'ㅎ',
  'ㅏ': 'ㅏ', 'ㅐ': 'ㅐ', 'ㅑ': 'ㅑ', 'ㅒ': 'ㅒ', 'ㅓ': 'ㅓ',
  'ㅔ': 'ㅔ', 'ㅕ': 'ㅕ', 'ㅖ': 'ㅖ', 'ㅗ': 'ㅗ', 'ㅘ': 'ㅘ',
  'ㅙ': 'ㅙ', 'ㅚ': 'ㅚ', 'ㅛ': 'ㅛ', 'ㅜ': 'ㅜ', 'ㅝ': 'ㅝ',
  'ㅞ': 'ㅞ', 'ㅟ': 'ㅟ', 'ㅠ': 'ㅠ', 'ㅡ': 'ㅡ', 'ㅢ': 'ㅢ',
  'ㅣ': 'ㅣ',
};

/** 모음 자모 집합 */
const VOWEL_JAMO = new Set([
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ',
  'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
]);

/** MFA JSON 파일의 최상위 구조 */
interface MFAJson {
  words: MFAWord[];
  phones: MFAPhoneme[];
}

/**
 * MFA phone label을 한글 자모로 변환
 * 알 수 없는 레이블은 그대로 반환 (경고 포함)
 */
function labelToJamo(label: string): string {
  if (PAUSE_LABELS.has(label)) return '';
  const mapped = MFA_LABEL_TO_JAMO[label];
  if (!mapped) {
    console.warn(`[mfaParser] 알 수 없는 MFA 레이블: "${label}" — 원본 사용`);
    return label;
  }
  return mapped;
}

/**
 * 음소 위치 추론
 * 단순 규칙: 모음이면 nucleus, 아니면 기본 onset
 * (G2P 규칙 적용 후 coda 위치가 확정됨)
 */
function inferPosition(jamo: string, isVowel: boolean): PhonemePosition {
  if (isVowel) return 'nucleus';
  return 'onset'; // coda는 g2pRules에서 재분류
}

/**
 * MFA JSON 파일을 읽어 PhonemeToken[] 로 파싱
 *
 * @param jsonPath MFA 출력 JSON 파일 경로
 * @param intensities 음소별 RMS 강도 배열 (mfaParser 외부에서 주입, 없으면 0으로 채움)
 * @returns 시간순 PhonemeToken 배열 (pause 포함)
 */
export function parseMFA(
  jsonPath: string,
  intensities: number[] = []
): PhonemeToken[] {
  const raw = readFileSync(jsonPath, 'utf-8');
  const data: MFAJson = JSON.parse(raw);
  return parseMFAData(data, intensities);
}

/**
 * 이미 파싱된 MFAJson 객체로부터 PhonemeToken[] 생성
 * (테스트 및 직접 호출용)
 */
export function parseMFAData(
  data: MFAJson,
  intensities: number[] = []
): PhonemeToken[] {
  const tokens: PhonemeToken[] = [];
  const phones = data.phones ?? [];

  for (let i = 0; i < phones.length; i++) {
    const phone = phones[i];
    const duration = phone.end - phone.start;
    const isPause = PAUSE_LABELS.has(phone.label);

    if (isPause) {
      tokens.push({
        jamo: '',
        position: 'pause',
        start: phone.start,
        end: phone.end,
        duration,
        intensity: 0,
        isVowel: false,
        isPause: true,
        isDiphthong: false,
      });
      continue;
    }

    const jamo = labelToJamo(phone.label);
    const isVowel = VOWEL_JAMO.has(jamo);

    tokens.push({
      jamo,
      position: inferPosition(jamo, isVowel),
      start: phone.start,
      end: phone.end,
      duration,
      intensity: intensities[i] ?? 0,
      isVowel,
      isPause: false,
      isDiphthong: isVowel ? isDiphthong(jamo) : false,
    });
  }

  return tokens;
}

/**
 * 쉼(pause) 구간을 기준으로 토큰 배열을 음운구(phonological phrase) 단위로 분리
 * G2P 규칙은 음운구 내에서만 적용됨 (가이드 §2.1)
 *
 * @param tokens parseMFA() 결과
 * @param pauseThreshold 이 초 이상의 pause가 있으면 경계로 처리 (기본 0.4초, 규칙 12)
 */
export function splitIntoPhrases(
  tokens: PhonemeToken[],
  pauseThreshold = 0.4
): PhonemeToken[][] {
  const phrases: PhonemeToken[][] = [];
  let current: PhonemeToken[] = [];

  for (const token of tokens) {
    if (token.isPause && token.duration >= pauseThreshold) {
      if (current.length > 0) {
        phrases.push(current);
        current = [];
      }
    } else {
      current.push(token);
    }
  }

  if (current.length > 0) {
    phrases.push(current);
  }

  return phrases;
}

/**
 * 인접 토큰 사이의 묵음 간격(gap)을 pause 토큰으로 삽입
 * MFA가 두 단어 사이 간격을 명시적으로 표기하지 않은 경우 보완
 */
export function fillGaps(tokens: PhonemeToken[], threshold = 0.01): PhonemeToken[] {
  const result: PhonemeToken[] = [];

  for (let i = 0; i < tokens.length; i++) {
    result.push(tokens[i]);
    if (i < tokens.length - 1) {
      const gap = tokens[i + 1].start - tokens[i].end;
      if (gap >= threshold) {
        result.push({
          jamo: '',
          position: 'pause',
          start: tokens[i].end,
          end: tokens[i + 1].start,
          duration: gap,
          intensity: 0,
          isVowel: false,
          isPause: true,
          isDiphthong: false,
        });
      }
    }
  }

  return result;
}
