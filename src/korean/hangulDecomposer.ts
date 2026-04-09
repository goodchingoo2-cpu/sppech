// ============================================================
// 한글 자모 분리기
// Unicode 수식으로 음절 → 초성/중성/종성 분리
// ============================================================

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

// 초성 19개
const ONSETS = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

// 중성 21개
const VOWELS = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ',
  'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
];

// 종성 28개 (첫 번째는 빈 문자열 = 종성 없음)
const CODAS = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ',
  'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ',
  'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

// j계열 이중모음 (반모음 /j/ 선행)
const J_DIPHTHONGS = new Set(['ㅑ', 'ㅒ', 'ㅕ', 'ㅖ', 'ㅛ', 'ㅠ', 'ㅢ']);

// w계열 이중모음 (반모음 /w/ 선행)
const W_DIPHTHONGS = new Set(['ㅘ', 'ㅙ', 'ㅚ', 'ㅝ', 'ㅞ', 'ㅟ']);

// 이중모음 → 기저 단모음 매핑
const DIPHTHONG_BASE: Record<string, string> = {
  'ㅑ': 'ㅏ', 'ㅒ': 'ㅐ', 'ㅕ': 'ㅓ', 'ㅖ': 'ㅔ',
  'ㅛ': 'ㅗ', 'ㅠ': 'ㅜ', 'ㅢ': 'ㅣ',
  'ㅘ': 'ㅏ', 'ㅙ': 'ㅐ', 'ㅚ': 'ㅔ',
  'ㅝ': 'ㅓ', 'ㅞ': 'ㅔ', 'ㅟ': 'ㅣ',
};

/** 단일 음절 분리 결과 */
export interface JamoResult {
  onset: string;  // 초성 (예: 'ㄱ')
  vowel: string;  // 중성 (예: 'ㅏ')
  coda: string;   // 종성 (없으면 '')
}

/**
 * 한글 음절 하나를 초성/중성/종성으로 분리
 * 한글 음절이 아니면 null 반환
 */
export function decomposeHangul(syllable: string): JamoResult | null {
  const code = syllable.codePointAt(0);
  if (code === undefined || code < HANGUL_START || code > HANGUL_END) {
    return null;
  }
  const offset = code - HANGUL_START;
  const onsetIdx = Math.floor(offset / (21 * 28));
  const vowelIdx = Math.floor((offset % (21 * 28)) / 28);
  const codaIdx = offset % 28;
  return {
    onset: ONSETS[onsetIdx],
    vowel: VOWELS[vowelIdx],
    coda: CODAS[codaIdx],
  };
}

/**
 * 문자열 내 모든 한글 음절을 순서대로 분리
 * 한글 음절이 아닌 문자는 건너뜀
 */
export function decomposeText(text: string): JamoResult[] {
  const results: JamoResult[] = [];
  for (const char of text) {
    const result = decomposeHangul(char);
    if (result !== null) {
      results.push(result);
    }
  }
  return results;
}

/**
 * 해당 중성이 이중모음(반모음 포함 복합 모음)인지 판별
 */
export function isDiphthong(vowel: string): boolean {
  return J_DIPHTHONGS.has(vowel) || W_DIPHTHONGS.has(vowel);
}

/**
 * 이중모음의 반모음 타입 반환
 * j계열 → 'j', w계열 → 'w', 단모음 → null
 */
export function getSemivowelType(vowel: string): 'j' | 'w' | null {
  if (J_DIPHTHONGS.has(vowel)) return 'j';
  if (W_DIPHTHONGS.has(vowel)) return 'w';
  return null;
}

/**
 * 이중모음의 기저 단모음 반환
 * 단모음이면 그대로 반환
 */
export function getBaseVowel(diphthong: string): string {
  return DIPHTHONG_BASE[diphthong] ?? diphthong;
}
