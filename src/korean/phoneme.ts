/**
 * 자모 → 음소 코드 변환.
 *
 * 음소 코드는 비즈메(viseme) 매핑의 입력이다.
 * 조음 위치/방법이 유사한 자음은 같은 코드로 묶어, 비즈메 분기를 단순화한다.
 *
 * 자음 음소 코드
 *   M  : ㅁ ㅂ ㅃ ㅍ          (양순)
 *   N  : ㄴ ㄷ ㄸ ㅌ ㄹ         (치경)
 *   K  : ㄱ ㄲ ㅋ ㅎ            (연구개/성문)
 *   S  : ㅅ ㅆ ㅈ ㅉ ㅊ          (치찰)
 *   NG : 받침 ㅇ                 (연구개 비음)
 *   _  : 초성 ㅇ (음가 없음)
 *
 * 모음 음소 코드 (비즈메용 7분류)
 *   A    : ㅏ ㅑ
 *   EO   : ㅓ ㅕ ㅡ             (중성/평순)
 *   O    : ㅗ ㅛ ㅜ ㅠ           (원순)
 *   I    : ㅣ ㅔ ㅐ ㅖ ㅒ       (전설)
 *   WA   : ㅘ ㅙ ㅚ             (원순 → A/I 활음)
 *   WEO  : ㅝ ㅞ ㅟ             (원순 → EO/I 활음)
 *   UI   : ㅢ                   (EO→I 활음)
 */

export type ConsonantPhoneme = 'M' | 'N' | 'K' | 'S' | 'NG' | '_';
export type VowelPhoneme = 'A' | 'EO' | 'O' | 'I' | 'WA' | 'WEO' | 'UI';
export type Phoneme = ConsonantPhoneme | VowelPhoneme;

export interface SyllablePhonemes {
  readonly onset: ConsonantPhoneme;      // 초성
  readonly nucleus: VowelPhoneme;        // 중성
  readonly coda: ConsonantPhoneme | null; // 종성 (없으면 null)
}

const CHO_TO_PHONEME: Readonly<Record<string, ConsonantPhoneme>> = {
  'ㄱ': 'K', 'ㄲ': 'K', 'ㅋ': 'K', 'ㅎ': 'K',
  'ㄴ': 'N', 'ㄷ': 'N', 'ㄸ': 'N', 'ㅌ': 'N', 'ㄹ': 'N',
  'ㅁ': 'M', 'ㅂ': 'M', 'ㅃ': 'M', 'ㅍ': 'M',
  'ㅅ': 'S', 'ㅆ': 'S', 'ㅈ': 'S', 'ㅉ': 'S', 'ㅊ': 'S',
  'ㅇ': '_',
};

/**
 * 종성 → 음소.
 * 한국어 종성은 7대표음(ㄱ/ㄴ/ㄷ/ㄹ/ㅁ/ㅂ/ㅇ)으로 중화된다.
 * 여기서는 비즈메용으로 더 단순화.
 */
const JONG_TO_PHONEME: Readonly<Record<string, ConsonantPhoneme>> = {
  // 연구개 (ㄱ 대표음)
  'ㄱ': 'K', 'ㄲ': 'K', 'ㅋ': 'K', 'ㄳ': 'K', 'ㄺ': 'K',
  // 치경 (ㄴ/ㄷ/ㄹ 대표음)
  'ㄴ': 'N', 'ㄵ': 'N', 'ㄶ': 'N',
  'ㄷ': 'N', 'ㅅ': 'N', 'ㅆ': 'N', 'ㅈ': 'N', 'ㅊ': 'N', 'ㅌ': 'N', 'ㅎ': 'N',
  'ㄹ': 'N', 'ㄼ': 'N', 'ㄽ': 'N', 'ㄾ': 'N', 'ㅀ': 'N',
  // 양순 (ㅁ/ㅂ)
  'ㅁ': 'M', 'ㄻ': 'M',
  'ㅂ': 'M', 'ㅍ': 'M', 'ㅄ': 'M', 'ㄿ': 'M',
  // 연구개 비음
  'ㅇ': 'NG',
};

const JUNG_TO_PHONEME: Readonly<Record<string, VowelPhoneme>> = {
  'ㅏ': 'A',  'ㅑ': 'A',
  'ㅓ': 'EO', 'ㅕ': 'EO', 'ㅡ': 'EO',
  'ㅗ': 'O',  'ㅛ': 'O',  'ㅜ': 'O',  'ㅠ': 'O',
  'ㅣ': 'I',  'ㅔ': 'I',  'ㅐ': 'I',  'ㅖ': 'I',  'ㅒ': 'I',
  'ㅘ': 'WA', 'ㅙ': 'WA', 'ㅚ': 'WA',
  'ㅝ': 'WEO','ㅞ': 'WEO','ㅟ': 'WEO',
  'ㅢ': 'UI',
};

export function choToPhoneme(cho: string): ConsonantPhoneme {
  const p = CHO_TO_PHONEME[cho];
  if (!p) throw new Error(`Unknown onset: "${cho}"`);
  return p;
}

export function jungToPhoneme(jung: string): VowelPhoneme {
  const p = JUNG_TO_PHONEME[jung];
  if (!p) throw new Error(`Unknown nucleus: "${jung}"`);
  return p;
}

export function jongToPhoneme(jong: string): ConsonantPhoneme | null {
  if (jong === '') return null;
  const p = JONG_TO_PHONEME[jong];
  if (!p) throw new Error(`Unknown coda: "${jong}"`);
  return p;
}

export function syllableToPhonemes(s: { cho: string; jung: string; jong: string }): SyllablePhonemes {
  return {
    onset: choToPhoneme(s.cho),
    nucleus: jungToPhoneme(s.jung),
    coda: jongToPhoneme(s.jong),
  };
}

export function isVowel(p: Phoneme): p is VowelPhoneme {
  return p === 'A' || p === 'EO' || p === 'O' || p === 'I' || p === 'WA' || p === 'WEO' || p === 'UI';
}
