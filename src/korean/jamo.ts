/**
 * 한글 음절(AC00~D7A3)의 초성/중성/종성 분리.
 * 유니코드 공식: 음절코드 = 0xAC00 + 초성 × 588 + 중성 × 28 + 종성
 *   - 초성: 19개 (ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ ㅁ ㅂ ㅃ ㅅ ㅆ ㅇ ㅈ ㅉ ㅊ ㅋ ㅌ ㅍ ㅎ)
 *   - 중성: 21개
 *   - 종성: 28개 (0은 받침 없음)
 */

export const CHO: readonly string[] = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

export const JUNG: readonly string[] = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
];

export const JONG: readonly string[] = [
  '',   'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

const SYLLABLE_BASE = 0xac00;
const SYLLABLE_LAST = 0xd7a3;
const JUNG_COUNT = 21;
const JONG_COUNT = 28;

export interface Syllable {
  readonly char: string;
  readonly cho: string;   // 초성 자모
  readonly jung: string;  // 중성 자모
  readonly jong: string;  // 종성 자모 (없으면 '')
}

export interface NonSyllable {
  readonly char: string;
  readonly kind: 'space' | 'punct' | 'other';
}

export type Token = Syllable | NonSyllable;

export function isHangulSyllable(ch: string): boolean {
  if (ch.length !== 1) return false;
  const code = ch.charCodeAt(0);
  return code >= SYLLABLE_BASE && code <= SYLLABLE_LAST;
}

export function decomposeSyllable(ch: string): Syllable {
  if (!isHangulSyllable(ch)) {
    throw new Error(`Not a Hangul syllable: "${ch}"`);
  }
  const offset = ch.charCodeAt(0) - SYLLABLE_BASE;
  const choIdx = Math.floor(offset / (JUNG_COUNT * JONG_COUNT));
  const jungIdx = Math.floor((offset % (JUNG_COUNT * JONG_COUNT)) / JONG_COUNT);
  const jongIdx = offset % JONG_COUNT;
  return {
    char: ch,
    cho: CHO[choIdx]!,
    jung: JUNG[jungIdx]!,
    jong: JONG[jongIdx]!,
  };
}

export function composeSyllable(cho: string, jung: string, jong: string = ''): string {
  const choIdx = CHO.indexOf(cho);
  const jungIdx = JUNG.indexOf(jung);
  const jongIdx = JONG.indexOf(jong);
  if (choIdx < 0 || jungIdx < 0 || jongIdx < 0) {
    throw new Error(`Invalid jamo: cho="${cho}" jung="${jung}" jong="${jong}"`);
  }
  return String.fromCharCode(
    SYLLABLE_BASE + choIdx * JUNG_COUNT * JONG_COUNT + jungIdx * JONG_COUNT + jongIdx,
  );
}

/**
 * 문자열을 Token 배열로 변환.
 * 한글 음절은 Syllable, 공백/문장부호/기타는 NonSyllable로 유지한다.
 */
export function tokenize(text: string): Token[] {
  const result: Token[] = [];
  for (const ch of text) {
    if (isHangulSyllable(ch)) {
      result.push(decomposeSyllable(ch));
    } else if (/\s/.test(ch)) {
      result.push({ char: ch, kind: 'space' });
    } else if (/[.,!?;:'"()\-—…]/.test(ch)) {
      result.push({ char: ch, kind: 'punct' });
    } else {
      result.push({ char: ch, kind: 'other' });
    }
  }
  return result;
}

export function isSyllable(t: Token): t is Syllable {
  return 'cho' in t;
}
