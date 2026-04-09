// ============================================================
// 텍스트 파서
// 한국어 텍스트 → PhonemeToken[] (타이밍 없는 구조)
// phonemeTiming.ts의 assignTimings()로 타이밍을 채워서 사용
// ============================================================

import { decomposeHangul, isDiphthong } from '../korean/hangulDecomposer.js';
import type { PhonemeToken, PhonemePosition } from './types.js';

type PartialToken = Omit<PhonemeToken, 'start' | 'end' | 'duration' | 'intensity'>;

/**
 * 한국어 텍스트 → 타이밍 없는 PhonemeToken[]
 *
 * - 한글 음절: 초성/중성/종성으로 분리
 * - 공백/줄바꿈: pause 토큰 (연속 공백은 1개로 합침)
 * - 한글이 아닌 문자(영어, 숫자, 특수문자): 건너뜀
 */
export function parseText(text: string): PartialToken[] {
  const result: PartialToken[] = [];
  let lastWasPause = false;

  for (const char of text) {
    // 공백/줄바꿈 → pause (연속 합침)
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      if (!lastWasPause) {
        result.push({
          jamo: '',
          position: 'pause',
          isVowel: false,
          isPause: true,
          isDiphthong: false,
        });
        lastWasPause = true;
      }
      continue;
    }

    // 한글 음절 분리 시도
    const jamo = decomposeHangul(char);
    if (jamo === null) {
      // 한글 아님 → skip
      continue;
    }

    lastWasPause = false;

    // 초성 (ㅇ 포함, 음가 없어도 토큰으로 포함)
    result.push({
      jamo: jamo.onset,
      position: 'onset',
      isVowel: false,
      isPause: false,
      isDiphthong: false,
    });

    // 중성 (모음)
    result.push({
      jamo: jamo.vowel,
      position: 'nucleus',
      isVowel: true,
      isPause: false,
      isDiphthong: isDiphthong(jamo.vowel),
    });

    // 종성 (있을 때만)
    if (jamo.coda !== '') {
      result.push({
        jamo: jamo.coda,
        position: 'coda',
        isVowel: false,
        isPause: false,
        isDiphthong: false,
      });
    }
  }

  return result;
}
