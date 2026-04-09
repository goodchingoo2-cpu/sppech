import { describe, it, expect } from 'vitest';
import { parseMFAData, splitIntoPhrases, fillGaps } from '../src/input/mfaParser.js';
import type { PhonemeToken } from '../src/input/types.js';

// ── 헬퍼: 테스트용 MFA 데이터 생성 ────────────────────────

function makePhone(label: string, start: number, end: number) {
  return { label, start, end };
}

// "아버지" 발화 샘플 (fixtures/sample.mfa.json과 동일)
const ABEOJI_DATA = {
  words: [{ word: '아버지', start: 0.0, end: 0.85 }],
  phones: [
    makePhone('ㅇ', 0.0,  0.12),
    makePhone('ㅏ', 0.12, 0.25),
    makePhone('ㅂ', 0.25, 0.40),
    makePhone('ㅓ', 0.40, 0.55),
    makePhone('ㅈ', 0.55, 0.68),
    makePhone('ㅣ', 0.68, 0.85),
  ],
};

// pause 포함 데이터
const WITH_PAUSE_DATA = {
  words: [],
  phones: [
    makePhone('ㅏ', 0.0,  0.2),
    makePhone('sp', 0.2,  0.7),  // 0.5초 pause
    makePhone('ㅣ', 0.7,  0.9),
  ],
};

// 짧은 pause (0.3초) 포함
const SHORT_PAUSE_DATA = {
  words: [],
  phones: [
    makePhone('ㅏ', 0.0,  0.2),
    makePhone('sp', 0.2,  0.5),  // 0.3초 — 임계값 미만
    makePhone('ㅣ', 0.5,  0.7),
  ],
};

// ── 테스트 ─────────────────────────────────────────────────

describe('parseMFAData — 아버지 발화', () => {
  const tokens = parseMFAData(ABEOJI_DATA);

  it('6개 토큰 생성', () => {
    expect(tokens).toHaveLength(6);
  });

  it('모든 자모가 올바르게 매핑됨', () => {
    expect(tokens.map(t => t.jamo)).toEqual(['ㅇ', 'ㅏ', 'ㅂ', 'ㅓ', 'ㅈ', 'ㅣ']);
  });

  it('타이밍 정보 정확', () => {
    expect(tokens[0].start).toBe(0.0);
    expect(tokens[0].end).toBe(0.12);
    expect(tokens[0].duration).toBeCloseTo(0.12);
  });

  it('모음 판별: ㅏ,ㅓ,ㅣ → isVowel=true', () => {
    expect(tokens[1].isVowel).toBe(true); // ㅏ
    expect(tokens[3].isVowel).toBe(true); // ㅓ
    expect(tokens[5].isVowel).toBe(true); // ㅣ
  });

  it('자음 판별: ㅇ,ㅂ,ㅈ → isVowel=false', () => {
    expect(tokens[0].isVowel).toBe(false); // ㅇ
    expect(tokens[2].isVowel).toBe(false); // ㅂ
    expect(tokens[4].isVowel).toBe(false); // ㅈ
  });

  it('isPause=false (모든 토큰)', () => {
    expect(tokens.every(t => !t.isPause)).toBe(true);
  });

  it('모음 위치는 nucleus', () => {
    expect(tokens[1].position).toBe('nucleus'); // ㅏ
  });

  it('intensity 주입: 인덱스별 값 할당', () => {
    const intensities = [0, 0.8, 0, 0.6, 0, 0.9];
    const t = parseMFAData(ABEOJI_DATA, intensities);
    expect(t[0].intensity).toBe(0);
    expect(t[1].intensity).toBe(0.8);
    expect(t[3].intensity).toBe(0.6);
  });

  it('isDiphthong: 단모음은 false', () => {
    expect(tokens[1].isDiphthong).toBe(false); // ㅏ
    expect(tokens[5].isDiphthong).toBe(false); // ㅣ
  });
});

describe('parseMFAData — 이중모음', () => {
  it('ㅑ → isDiphthong=true', () => {
    const data = {
      words: [],
      phones: [makePhone('ㅑ', 0, 0.2)],
    };
    const tokens = parseMFAData(data);
    expect(tokens[0].isDiphthong).toBe(true);
  });

  it('ㅘ → isDiphthong=true', () => {
    const data = {
      words: [],
      phones: [makePhone('ㅘ', 0, 0.2)],
    };
    const tokens = parseMFAData(data);
    expect(tokens[0].isDiphthong).toBe(true);
  });
});

describe('parseMFAData — pause 처리', () => {
  it('sp 레이블 → isPause=true, jamo=빈문자열', () => {
    const tokens = parseMFAData(WITH_PAUSE_DATA);
    const pauseToken = tokens[1];
    expect(pauseToken.isPause).toBe(true);
    expect(pauseToken.jamo).toBe('');
    expect(pauseToken.position).toBe('pause');
  });

  it('pause의 intensity는 0', () => {
    const tokens = parseMFAData(WITH_PAUSE_DATA, [0.5, 0.8, 0.7]);
    expect(tokens[1].intensity).toBe(0);
  });

  it('sil, SIL, <eps> 모두 pause로 처리', () => {
    const data = {
      words: [],
      phones: [
        makePhone('sil', 0.0, 0.1),
        makePhone('SIL', 0.1, 0.2),
        makePhone('<eps>', 0.2, 0.3),
        makePhone('', 0.3, 0.4),
      ],
    };
    const tokens = parseMFAData(data);
    expect(tokens.every(t => t.isPause)).toBe(true);
  });
});

describe('parseMFAData — MFA 영문 레이블 변환', () => {
  it('"a" → ㅏ', () => {
    const data = { words: [], phones: [makePhone('a', 0, 0.2)] };
    expect(parseMFAData(data)[0].jamo).toBe('ㅏ');
  });

  it('"b" → ㅂ', () => {
    const data = { words: [], phones: [makePhone('b', 0, 0.1)] };
    const token = parseMFAData(data)[0];
    expect(token.jamo).toBe('ㅂ');
    expect(token.isVowel).toBe(false);
  });

  it('"ng" → ㅇ', () => {
    const data = { words: [], phones: [makePhone('ng', 0, 0.1)] };
    expect(parseMFAData(data)[0].jamo).toBe('ㅇ');
  });
});

describe('splitIntoPhrases', () => {
  it('0.5초 pause → 2개 음운구', () => {
    const tokens = parseMFAData(WITH_PAUSE_DATA);
    const phrases = splitIntoPhrases(tokens, 0.4);
    expect(phrases).toHaveLength(2);
    expect(phrases[0]).toHaveLength(1); // ㅏ
    expect(phrases[1]).toHaveLength(1); // ㅣ
  });

  it('0.3초 pause(임계값 미만) → 1개 음운구', () => {
    const tokens = parseMFAData(SHORT_PAUSE_DATA);
    const phrases = splitIntoPhrases(tokens, 0.4);
    expect(phrases).toHaveLength(1);
    // pause 자체는 음운구에 포함됨 (짧은 pause는 경계가 아님)
    expect(phrases[0].length).toBeGreaterThan(0);
  });

  it('pause 없음 → 1개 음운구', () => {
    const tokens = parseMFAData(ABEOJI_DATA);
    const phrases = splitIntoPhrases(tokens, 0.4);
    expect(phrases).toHaveLength(1);
    expect(phrases[0]).toHaveLength(6);
  });

  it('빈 토큰 배열 → 빈 결과', () => {
    expect(splitIntoPhrases([], 0.4)).toEqual([]);
  });
});

describe('fillGaps', () => {
  it('gap이 있으면 pause 토큰 삽입', () => {
    const tokens: PhonemeToken[] = [
      {
        jamo: 'ㅏ', position: 'nucleus', start: 0.0, end: 0.2,
        duration: 0.2, intensity: 0, isVowel: true, isPause: false, isDiphthong: false,
      },
      {
        jamo: 'ㅣ', position: 'nucleus', start: 0.5, end: 0.7,
        duration: 0.2, intensity: 0, isVowel: true, isPause: false, isDiphthong: false,
      },
    ];
    const filled = fillGaps(tokens, 0.01);
    expect(filled).toHaveLength(3);
    expect(filled[1].isPause).toBe(true);
    expect(filled[1].start).toBeCloseTo(0.2);
    expect(filled[1].end).toBeCloseTo(0.5);
  });

  it('gap 없으면 토큰 추가 없음', () => {
    const tokens: PhonemeToken[] = [
      {
        jamo: 'ㅏ', position: 'nucleus', start: 0.0, end: 0.2,
        duration: 0.2, intensity: 0, isVowel: true, isPause: false, isDiphthong: false,
      },
      {
        jamo: 'ㅣ', position: 'nucleus', start: 0.2, end: 0.4,
        duration: 0.2, intensity: 0, isVowel: true, isPause: false, isDiphthong: false,
      },
    ];
    expect(fillGaps(tokens, 0.01)).toHaveLength(2);
  });
});
