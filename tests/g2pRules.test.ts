import { describe, it, expect } from 'vitest';
import {
  assignPositions,
  applyClusterSimplification,
  applyLiaison,
  applyHLiaison,
  applyNasalization,
  applyLateralization,
  applyAspiration,
  applyPalatalization,
  applyTensification,
  applyG2PRules,
  applyG2PRulesAll,
} from '../src/korean/g2pRules.js';
import type { PhonemeToken } from '../src/input/types.js';

// ── 테스트 헬퍼 ─────────────────────────────────────────────

function tok(
  jamo: string,
  start: number,
  end: number,
  isVowel = false,
  isPause = false
): PhonemeToken {
  return {
    jamo,
    position: isPause ? 'pause' : 'onset', // 초기값 onset; assignPositions 후 교정
    start,
    end,
    duration: end - start,
    intensity: 0,
    isVowel,
    isPause,
    isDiphthong: false,
  };
}

function vowel(jamo: string, start: number, end: number): PhonemeToken {
  return tok(jamo, start, end, true, false);
}

function pause(start: number, end: number): PhonemeToken {
  return tok('', start, end, false, true);
}

/** 결과 토큰 배열에서 jamo 문자열 추출 (검증 편의) */
function jamos(tokens: PhonemeToken[]): string[] {
  return tokens.map(t => t.jamo);
}

function positions(tokens: PhonemeToken[]): string[] {
  return tokens.map(t => t.position);
}

// ── 공통 시퀀스 ─────────────────────────────────────────────

// 아버지: [ㅇ,ㅏ,ㅂ,ㅓ,ㅈ,ㅣ]
const ABEOJI = [
  tok('ㅇ', 0.00, 0.12), vowel('ㅏ', 0.12, 0.25),
  tok('ㅂ', 0.25, 0.40), vowel('ㅓ', 0.40, 0.55),
  tok('ㅈ', 0.55, 0.68), vowel('ㅣ', 0.68, 0.85),
];

// 국민: [ㄱ,ㅜ,ㄱ,ㅁ,ㅣ,ㄴ]  → 비음화 → [ㄱ,ㅜ,ㅇ,ㅁ,ㅣ,ㄴ]
const GUKMIN = [
  tok('ㄱ', 0.0, 0.1), vowel('ㅜ', 0.1, 0.25),
  tok('ㄱ', 0.25, 0.35), tok('ㅁ', 0.35, 0.45),
  vowel('ㅣ', 0.45, 0.6), tok('ㄴ', 0.6, 0.7),
];

// 신라: [ㅅ,ㅣ,ㄴ,ㄹ,ㅏ]  → 유음화 → [ㅅ,ㅣ,ㄹ,ㄹ,ㅏ]
const SINRA = [
  tok('ㅅ', 0.0, 0.1), vowel('ㅣ', 0.1, 0.25),
  tok('ㄴ', 0.25, 0.35), tok('ㄹ', 0.35, 0.45),
  vowel('ㅏ', 0.45, 0.6),
];

// 좋고: [ㅈ,ㅗ,ㅎ,ㄱ,ㅗ]  → 격음화 → [ㅈ,ㅗ,ㅋ,ㅗ]
const JOHGO = [
  tok('ㅈ', 0.0, 0.1), vowel('ㅗ', 0.1, 0.25),
  tok('ㅎ', 0.25, 0.35), tok('ㄱ', 0.35, 0.45),
  vowel('ㅗ', 0.45, 0.6),
];

// 닭이: [ㄷ,ㅏ,ㄹ,ㄱ,ㅇ,ㅣ]  → 연음 → [ㄷ,ㅏ,ㄹ,ㄱ,ㅣ]
const DALGI = [
  tok('ㄷ', 0.0, 0.1), vowel('ㅏ', 0.1, 0.25),
  tok('ㄹ', 0.25, 0.35), tok('ㄱ', 0.35, 0.45),
  tok('ㅇ', 0.45, 0.5), vowel('ㅣ', 0.5, 0.65),
];

// ── assignPositions ─────────────────────────────────────────

describe('assignPositions', () => {
  it('아버지: 각 자음은 onset, 모음은 nucleus', () => {
    const result = assignPositions(ABEOJI);
    expect(positions(result)).toEqual([
      'onset', 'nucleus', 'onset', 'nucleus', 'onset', 'nucleus',
    ]);
  });

  it('두 자음 사이: 앞=coda, 뒤=onset', () => {
    // [ㄱ,ㅜ,ㄱ,ㅁ,ㅣ,ㄴ] → ㄱ(onset),ㅜ(nucleus),ㄱ(coda),ㅁ(onset),ㅣ(nucleus),ㄴ(coda)
    const result = assignPositions(GUKMIN);
    expect(result[2].position).toBe('coda');   // 첫 ㄱ (국의 받침)
    expect(result[3].position).toBe('onset');  // ㅁ (민의 초성)
    expect(result[5].position).toBe('coda');   // ㄴ (민의 받침)
  });

  it('모음 없는 시퀀스 → 모두 onset', () => {
    const tokens = [tok('ㄱ', 0, 0.1), tok('ㄴ', 0.1, 0.2)];
    const result = assignPositions(tokens);
    expect(positions(result)).toEqual(['onset', 'onset']);
  });

  it('단일 자음 + 모음: onset', () => {
    const tokens = [tok('ㄱ', 0, 0.1), vowel('ㅏ', 0.1, 0.3)];
    const result = assignPositions(tokens);
    expect(result[0].position).toBe('onset');
    expect(result[1].position).toBe('nucleus');
  });

  it('모음 + 단일 자음: coda', () => {
    const tokens = [vowel('ㅏ', 0, 0.2), tok('ㄱ', 0.2, 0.3)];
    const result = assignPositions(tokens);
    expect(result[0].position).toBe('nucleus');
    expect(result[1].position).toBe('coda');
  });
});

// ── applyClusterSimplification ──────────────────────────────

describe('applyClusterSimplification', () => {
  it('coda ㄺ → ㄱ', () => {
    const tokens = [
      vowel('ㅏ', 0, 0.2),
      { ...tok('ㄺ', 0.2, 0.35), position: 'coda' as const },
    ];
    const result = applyClusterSimplification(tokens);
    expect(result[1].jamo).toBe('ㄱ');
  });

  it('coda ㄻ → ㄹ', () => {
    const tokens = [
      vowel('ㅏ', 0, 0.2),
      { ...tok('ㄻ', 0.2, 0.35), position: 'coda' as const },
    ];
    const result = applyClusterSimplification(tokens);
    expect(result[1].jamo).toBe('ㄹ');
  });

  it('coda ㅄ → ㅂ', () => {
    const tokens = [
      vowel('ㅏ', 0, 0.2),
      { ...tok('ㅄ', 0.2, 0.35), position: 'coda' as const },
    ];
    const result = applyClusterSimplification(tokens);
    expect(result[1].jamo).toBe('ㅂ');
  });

  it('onset 위치는 변경 안 함', () => {
    const tokens = [{ ...tok('ㄺ', 0, 0.1), position: 'onset' as const }];
    const result = applyClusterSimplification(tokens);
    expect(result[0].jamo).toBe('ㄺ');
  });
});

// ── applyLiaison ────────────────────────────────────────────

describe('applyLiaison (연음)', () => {
  it('닭이: coda ㄱ + onset ㅇ → ㄱ onset으로 이동', () => {
    const withPositions = assignPositions(DALGI);
    const result = applyLiaison(withPositions);

    // 결과: [ㄷ,ㅏ,ㄹ,ㄱ(onset),ㅣ] - ㄱ이 ㅇ 자리로 이동
    const jamoArr = jamos(result);
    expect(jamoArr).not.toContain('ㅇ'); // 원래 ㅇ이 ㄱ으로 교체
    const gToken = result.find(t => t.jamo === 'ㄱ');
    expect(gToken?.position).toBe('onset');
  });

  it('연음 없는 경우 변경 없음 (아버지)', () => {
    const withPositions = assignPositions(ABEOJI);
    const result = applyLiaison(withPositions);
    expect(jamos(result)).toEqual(jamos(withPositions));
  });
});

// ── applyNasalization ───────────────────────────────────────

describe('applyNasalization (비음화)', () => {
  it('국민: coda ㄱ + onset ㅁ → coda ㅇ', () => {
    const withPositions = assignPositions(GUKMIN);
    const result = applyNasalization(withPositions);
    // 두 번째 ㄱ (coda, index 2) → ㅇ
    const codaToken = result.find(
      t => t.position === 'coda' && result.indexOf(t) === 2
    );
    // 비음화 후 coda 위치의 자음을 찾아 검증
    const codas = result.filter(t => t.position === 'coda');
    expect(codas[0].jamo).toBe('ㅇ');
  });

  it('십만(ㅂ+ㅁ): coda ㅂ → ㅁ', () => {
    const tokens = assignPositions([
      tok('ㅅ', 0, 0.1), vowel('ㅣ', 0.1, 0.2),
      tok('ㅂ', 0.2, 0.3), tok('ㅁ', 0.3, 0.4),
      vowel('ㅏ', 0.4, 0.5), tok('ㄴ', 0.5, 0.6),
    ]);
    const result = applyNasalization(tokens);
    const codas = result.filter(t => t.position === 'coda');
    expect(codas[0].jamo).toBe('ㅁ'); // ㅂ → ㅁ
  });

  it('맏며: coda ㄷ + onset ㅁ → coda ㄴ', () => {
    const tokens = assignPositions([
      tok('ㅁ', 0, 0.1), vowel('ㅏ', 0.1, 0.2),
      tok('ㄷ', 0.2, 0.3), tok('ㅁ', 0.3, 0.4),
      vowel('ㅕ', 0.4, 0.55),
    ]);
    const result = applyNasalization(tokens);
    const codas = result.filter(t => t.position === 'coda');
    expect(codas[0].jamo).toBe('ㄴ'); // ㄷ → ㄴ
  });

  it('비음 + 비음: 변경 없음', () => {
    const tokens = assignPositions([
      vowel('ㅏ', 0, 0.2),
      tok('ㄴ', 0.2, 0.3), tok('ㄴ', 0.3, 0.4),
      vowel('ㅏ', 0.4, 0.6),
    ]);
    const result = applyNasalization(tokens);
    expect(result.find(t => t.position === 'coda')?.jamo).toBe('ㄴ');
  });
});

// ── applyLateralization ─────────────────────────────────────

describe('applyLateralization (유음화)', () => {
  it('신라: coda ㄴ + onset ㄹ → coda ㄹ', () => {
    const withPositions = assignPositions(SINRA);
    const result = applyLateralization(withPositions);
    const coda = result.find(t => t.position === 'coda');
    expect(coda?.jamo).toBe('ㄹ'); // ㄴ → ㄹ
  });

  it('칼날(ㄹ+ㄴ): onset ㄴ → onset ㄹ', () => {
    const tokens = assignPositions([
      tok('ㅋ', 0, 0.1), vowel('ㅏ', 0.1, 0.2),
      tok('ㄹ', 0.2, 0.3), tok('ㄴ', 0.3, 0.4),
      vowel('ㅏ', 0.4, 0.5), tok('ㄹ', 0.5, 0.6),
    ]);
    const result = applyLateralization(tokens);
    // ㄹ coda + ㄴ onset → ㄹ onset
    const onsets = result.filter(t => t.position === 'onset');
    const secondSyllOnset = onsets[1];
    expect(secondSyllOnset?.jamo).toBe('ㄹ');
  });

  it('비음화 우선 확인: ㄴ+ㄴ은 유음화 미적용', () => {
    const tokens = assignPositions([
      vowel('ㅏ', 0, 0.2),
      tok('ㄴ', 0.2, 0.3), tok('ㄴ', 0.3, 0.4),
      vowel('ㅏ', 0.4, 0.6),
    ]);
    const result = applyLateralization(tokens);
    const coda = result.find(t => t.position === 'coda');
    expect(coda?.jamo).toBe('ㄴ'); // 변경 없음
  });
});

// ── applyAspiration ─────────────────────────────────────────

describe('applyAspiration (격음화)', () => {
  it('좋고: coda ㅎ + onset ㄱ → onset ㅋ', () => {
    const withPositions = assignPositions(JOHGO);
    const result = applyAspiration(withPositions);
    const onsets = result.filter(t => t.position === 'onset');
    // 두 번째 음절 onset이 ㅋ가 되어야 함
    expect(onsets.some(t => t.jamo === 'ㅋ')).toBe(true);
  });

  it('입학(ㅂ+ㅎ): coda ㅂ + onset ㅎ → onset ㅍ', () => {
    const tokens = assignPositions([
      vowel('ㅣ', 0, 0.15),
      tok('ㅂ', 0.15, 0.25), tok('ㅎ', 0.25, 0.35),
      vowel('ㅏ', 0.35, 0.5), tok('ㄱ', 0.5, 0.6),
    ]);
    const result = applyAspiration(tokens);
    expect(result.some(t => t.jamo === 'ㅍ')).toBe(true);
    expect(result.some(t => t.jamo === 'ㅎ')).toBe(false); // ㅎ 사라짐
  });

  it('먹히다(ㄱ+ㅎ): → ㅋ', () => {
    const tokens = assignPositions([
      tok('ㅁ', 0, 0.1), vowel('ㅓ', 0.1, 0.2),
      tok('ㄱ', 0.2, 0.3), tok('ㅎ', 0.3, 0.4),
      vowel('ㅣ', 0.4, 0.55),
    ]);
    const result = applyAspiration(tokens);
    expect(result.some(t => t.jamo === 'ㅋ')).toBe(true);
  });
});

// ── applyPalatalization ─────────────────────────────────────

describe('applyPalatalization (구개음화)', () => {
  it('해돋이(ㄷ+ㅇ+ㅣ): ㄷ → ㅈ', () => {
    const tokens = assignPositions([
      tok('ㅎ', 0, 0.1), vowel('ㅐ', 0.1, 0.2),
      tok('ㄷ', 0.2, 0.3), tok('ㅇ', 0.3, 0.4),
      vowel('ㅣ', 0.4, 0.55),
    ]);
    const result = applyPalatalization(tokens);
    expect(result.some(t => t.jamo === 'ㅈ')).toBe(true);
    expect(result.some(t => t.jamo === 'ㄷ')).toBe(false);
  });

  it('같이(ㅌ+ㅇ+ㅣ): ㅌ → ㅊ', () => {
    const tokens = assignPositions([
      tok('ㄱ', 0, 0.1), vowel('ㅏ', 0.1, 0.2),
      tok('ㅌ', 0.2, 0.3), tok('ㅇ', 0.3, 0.4),
      vowel('ㅣ', 0.4, 0.55),
    ]);
    const result = applyPalatalization(tokens);
    expect(result.some(t => t.jamo === 'ㅊ')).toBe(true);
    expect(result.some(t => t.jamo === 'ㅌ')).toBe(false);
  });

  it('ㄷ+ㅏ: 구개음화 미적용', () => {
    const tokens = assignPositions([
      vowel('ㅏ', 0, 0.2),
      tok('ㄷ', 0.2, 0.3), tok('ㅇ', 0.3, 0.4),
      vowel('ㅏ', 0.4, 0.6), // ㅣ가 아님
    ]);
    const result = applyPalatalization(tokens);
    expect(result.some(t => t.jamo === 'ㄷ')).toBe(true); // 변경 없음
  });
});

// ── applyTensification ──────────────────────────────────────

describe('applyTensification (경음화, SKIP_VISUAL)', () => {
  it('변환 없이 그대로 반환', () => {
    const tokens = assignPositions(ABEOJI);
    const result = applyTensification(tokens);
    expect(jamos(result)).toEqual(jamos(tokens));
  });
});

// ── applyG2PRules (통합) ────────────────────────────────────

describe('applyG2PRules (통합 규칙 적용)', () => {
  it('아버지: 규칙 적용 후 자모 변경 없음 (음운 현상 없음)', () => {
    const result = applyG2PRules(ABEOJI);
    expect(jamos(result)).toEqual(['ㅇ', 'ㅏ', 'ㅂ', 'ㅓ', 'ㅈ', 'ㅣ']);
  });

  it('국민: 비음화 적용 후 두 번째 ㄱ → ㅇ', () => {
    const result = applyG2PRules(GUKMIN);
    const codas = result.filter(t => t.position === 'coda');
    expect(codas[0].jamo).toBe('ㅇ');
  });

  it('신라: 유음화 적용 후 ㄴ → ㄹ', () => {
    const result = applyG2PRules(SINRA);
    const coda = result.find(t => t.position === 'coda');
    expect(coda?.jamo).toBe('ㄹ');
  });

  it('좋고: 격음화 적용 후 ㄱ onset → ㅋ', () => {
    const result = applyG2PRules(JOHGO);
    expect(result.some(t => t.jamo === 'ㅋ')).toBe(true);
  });

  it('위치 정보 배정 완료 (nucleus 포함)', () => {
    const result = applyG2PRules(ABEOJI);
    expect(result.filter(t => t.position === 'nucleus').length).toBe(3);
  });
});

// ── applyG2PRulesAll (음운구 분리) ──────────────────────────

describe('applyG2PRulesAll (음운구 단위 처리)', () => {
  it('pause ≥ 0.4초 → 두 구 분리 처리', () => {
    const tokens = [
      ...SINRA,
      pause(0.6, 1.1), // 0.5초 pause
      ...GUKMIN.map(t => ({ ...t, start: t.start + 1.1, end: t.end + 1.1 })),
    ];
    const result = applyG2PRulesAll(tokens, { pauseThreshold: 0.4 });

    // 신라 부분: ㄴ → ㄹ 유음화
    const sinraPart = result.filter(t => t.start < 0.6);
    const sinraCoda = sinraPart.find(t => t.position === 'coda');
    expect(sinraCoda?.jamo).toBe('ㄹ');

    // 국민 부분: ㄱ → ㅇ 비음화
    const gukminPart = result.filter(t => !t.isPause && t.start > 1.0);
    const gukminCodas = gukminPart.filter(t => t.position === 'coda');
    expect(gukminCodas[0]?.jamo).toBe('ㅇ');
  });

  it('짧은 pause < 0.4초 → 하나의 음운구로 처리 (유음화 적용)', () => {
    // [ㅣ, ㄴ, pause(0.3s), ㄹ, ㅏ] → ㅣ+ㄴ(coda)+ㄹ(onset)+ㅏ 구조
    // assignPositions: ㄴ=coda (ㅣ 이후, ㄹ과 함께 두 자음), ㄹ=onset
    // → 유음화 적용 후 coda ㄴ → ㄹ
    const tokens = [
      vowel('ㅣ', 0, 0.1),
      tok('ㄴ', 0.1, 0.2),
      pause(0.2, 0.5), // 0.3초 — 임계값 미만, 경계 아님
      tok('ㄹ', 0.5, 0.6), vowel('ㅏ', 0.6, 0.7),
    ];
    const result = applyG2PRulesAll(tokens, { pauseThreshold: 0.4 });
    // ㄴ(coda)+ㄹ(onset) 유음화 → coda가 ㄹ로 변경
    const coda = result.find(t => t.position === 'coda');
    expect(coda?.jamo).toBe('ㄹ'); // 유음화 적용
  });

  it('pause 보존: 결과에 pause 토큰 포함', () => {
    const tokens = [
      tok('ㄴ', 0, 0.1), vowel('ㅏ', 0.1, 0.2),
      pause(0.2, 0.7), // 0.5초
      vowel('ㅏ', 0.7, 0.9),
    ];
    const result = applyG2PRulesAll(tokens, { pauseThreshold: 0.4 });
    expect(result.some(t => t.isPause)).toBe(true);
  });
});
