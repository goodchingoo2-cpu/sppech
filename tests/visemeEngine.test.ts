import { describe, it, expect } from 'vitest';
import { applyCoarticulation } from '../src/viseme/coarticulation.js';
import { calculatePhraseWeights } from '../src/viseme/prosodicWeight.js';
import { fillConsonantLips } from '../src/viseme/splineInterpolator.js';
import { mapToVisemes } from '../src/viseme/visemeMapper.js';
import type { PhonemeToken, VisemeFrame } from '../src/input/types.js';

// ── 헬퍼 ───────────────────────────────────────────────────

function tok(
  jamo: string,
  start: number,
  end: number,
  isVowel = false,
  isPause = false,
  isDiphthong = false,
  intensity = 0
): PhonemeToken {
  return {
    jamo,
    position: isPause ? 'pause' : isVowel ? 'nucleus' : 'onset',
    start,
    end,
    duration: end - start,
    intensity,
    isVowel,
    isPause,
    isDiphthong,
  };
}

function vowel(jamo: string, s: number, e: number, intensity = 0.5): PhonemeToken {
  const diphthongs = new Set(['ㅑ','ㅒ','ㅕ','ㅖ','ㅛ','ㅠ','ㅢ','ㅘ','ㅙ','ㅚ','ㅝ','ㅞ','ㅟ']);
  return tok(jamo, s, e, true, false, diphthongs.has(jamo), intensity);
}

function cons(jamo: string, s: number, e: number): PhonemeToken {
  return tok(jamo, s, e, false, false, false, 0);
}

function pause(s: number, e: number): PhonemeToken {
  return tok('', s, e, false, true);
}

// ── calculatePhraseWeights ──────────────────────────────────

describe('calculatePhraseWeights', () => {
  it('모음만 있는 경우 가중치 0보다 큰 값', () => {
    const tokens = [vowel('ㅏ', 0, 0.3, 50)];
    const weights = calculatePhraseWeights(tokens);
    expect(weights[0]).toBeGreaterThan(0);
    expect(weights[0]).toBeLessThanOrEqual(1.0);
  });

  it('자음은 가중치 0', () => {
    const tokens = [cons('ㄱ', 0, 0.1), vowel('ㅏ', 0.1, 0.3, 50)];
    const weights = calculatePhraseWeights(tokens);
    expect(weights[0]).toBe(0); // 자음
    expect(weights[1]).toBeGreaterThan(0); // 모음
  });

  it('강도와 길이에 따라 더 강한 모음의 가중치가 커진다', () => {
    const tokens = [
      vowel('ㅏ', 0, 0.3, 10),
      vowel('ㅣ', 0.3, 0.45, 100),
    ];
    const weights = calculatePhraseWeights(tokens);
    expect(weights[1]).toBeGreaterThan(weights[0]);
  });

  it('intensity=0이면 운율 가중치도 0', () => {
    const tokens = [vowel('ㅏ', 0, 0.3, 0)];
    const weights = calculatePhraseWeights(tokens);
    expect(weights[0]).toBe(0);
  });
});

// ── applyCoarticulation — 규칙별 검증 ─────────────────────

describe('규칙 5: 모음 → 입술+혀 모델 매핑', () => {
  it('ㅏ 모음 → lipModel=L1, tongueModel=VT2', () => {
    const tokens = [cons('ㅇ', 0, 0.1), vowel('ㅏ', 0.1, 0.3)];
    const weights = calculatePhraseWeights(tokens);
    const frames = applyCoarticulation(tokens, weights);
    const vFrame = frames.find(f => f.timeStart >= 0.1);
    expect(vFrame?.lipModel).toBe('L1');
    expect(vFrame?.tongueModel).toBe('VT2');
  });

  it('ㅣ 모음 → lipModel=L7, tongueModel=VT1', () => {
    const tokens = [vowel('ㅣ', 0, 0.2)];
    const weights = calculatePhraseWeights(tokens);
    const frames = applyCoarticulation(tokens, weights);
    expect(frames[0].lipModel).toBe('L7');
    expect(frames[0].tongueModel).toBe('VT1');
  });
});

describe('규칙 6: 자음 → 혀만, 입술=null (스플라인 위임)', () => {
  it('일반 자음(ㄴ) → lipModel=null, tongueModel=T1', () => {
    const tokens = [
      vowel('ㅏ', 0, 0.2),
      cons('ㄴ', 0.2, 0.3),
      vowel('ㅏ', 0.3, 0.5),
    ];
    const weights = calculatePhraseWeights(tokens);
    const frames = applyCoarticulation(tokens, weights);
    const consFrame = frames.find(f => f.timeStart === 0.2);
    expect(consFrame?.lipModel).toBeNull();
    expect(consFrame?.tongueModel).toBe('T1');
  });
});

describe('규칙 7: 양순음 → lipModel=L9, lipWeight=1.0', () => {
  it('ㅂ → lipModel=L9, lipWeight=1.0', () => {
    const tokens = [
      vowel('ㅏ', 0, 0.2),
      { ...cons('ㅂ', 0.2, 0.35), position: 'onset' as const },
      vowel('ㅓ', 0.35, 0.5),
    ];
    const weights = calculatePhraseWeights(tokens);
    const frames = applyCoarticulation(tokens, weights);
    const bilabialFrame = frames.find(f => f.timeStart === 0.2);
    expect(bilabialFrame?.lipModel).toBe('L9');
    expect(bilabialFrame?.lipWeight).toBe(1.0);
  });

  it('ㅁ → lipModel=L9, lipWeight=1.0', () => {
    const tokens = [cons('ㅁ', 0, 0.15), vowel('ㅏ', 0.15, 0.3)];
    const weights = calculatePhraseWeights(tokens);
    const frames = applyCoarticulation(tokens, weights);
    expect(frames[0].lipModel).toBe('L9');
    expect(frames[0].lipWeight).toBe(1.0);
  });

  it('ㅍ → lipModel=L9, tongueModel=T4', () => {
    const tokens = [cons('ㅍ', 0, 0.15), vowel('ㅏ', 0.15, 0.3)];
    const weights = calculatePhraseWeights(tokens);
    const frames = applyCoarticulation(tokens, weights);
    expect(frames[0].lipModel).toBe('L9');
    expect(frames[0].tongueModel).toBe('T4');
  });
});

describe('규칙 8: 치경음 앞뒤 모음 lipWeight ≤ 0.6', () => {
  it('치경음 ㄴ 인접 모음의 lipWeight ≤ 0.6', () => {
    const tokens = [
      cons('ㄴ', 0, 0.1),
      vowel('ㅏ', 0.1, 0.3, 100), // 높은 intensity → 원래 가중치 높음
    ];
    const weights = calculatePhraseWeights(tokens);
    const frames = applyCoarticulation(tokens, weights);
    const vowelFrame = frames.find(f => !f.tongueModel?.startsWith('T') || f.lipModel !== null);
    // 모음 프레임의 lipWeight는 0.6 이하
    const vf = frames.find(f => f.timeStart >= 0.1);
    expect(vf?.lipWeight).toBeLessThanOrEqual(0.6);
  });
});

describe('규칙 9: 원순 모음 + 양순음 → blendWith', () => {
  it('ㅗ 모음 + 인접 ㅂ → blendWith={model:L9, weight:0.4}', () => {
    const tokens = [
      cons('ㅂ', 0, 0.15),
      vowel('ㅗ', 0.15, 0.35),
    ];
    const weights = calculatePhraseWeights(tokens);
    const frames = applyCoarticulation(tokens, weights);
    const vowelFrame = frames.find(f => f.timeStart >= 0.15);
    expect(vowelFrame?.blendWith?.model).toBe('L9');
    expect(vowelFrame?.blendWith?.weight).toBe(0.4);
  });

  it('ㅗ 모음 + 비양순음(ㄴ) → blendWith 없음', () => {
    const tokens = [
      cons('ㄴ', 0, 0.15),
      vowel('ㅗ', 0.15, 0.35),
    ];
    const weights = calculatePhraseWeights(tokens);
    const frames = applyCoarticulation(tokens, weights);
    const vowelFrame = frames.find(f => f.timeStart >= 0.15);
    expect(vowelFrame?.blendWith).toBeUndefined();
  });
});

describe('규칙 10+11: 이중모음 분리', () => {
  it('ㅑ → 2개 프레임 생성 (반모음 + 단모음)', () => {
    const tokens = [vowel('ㅑ', 0, 0.4)];
    const weights = calculatePhraseWeights(tokens);
    const frames = applyCoarticulation(tokens, weights);
    expect(frames).toHaveLength(2);
  });

  it('반모음 프레임: j계열 → lipModel=L8', () => {
    const tokens = [vowel('ㅑ', 0, 0.4)];
    const weights = calculatePhraseWeights(tokens);
    const frames = applyCoarticulation(tokens, weights);
    expect(frames[0].lipModel).toBe('L8');  // 반모음 j → L8
  });

  it('반모음 프레임: w계열 → lipModel=L9', () => {
    const tokens = [vowel('ㅘ', 0, 0.4)];
    const weights = calculatePhraseWeights(tokens);
    const frames = applyCoarticulation(tokens, weights);
    expect(frames[0].lipModel).toBe('L9');  // 반모음 w → L9
  });

  it('규칙 10: 반모음 구간 = 전체의 절반', () => {
    const tokens = [vowel('ㅑ', 0, 0.4)];
    const weights = calculatePhraseWeights(tokens);
    const frames = applyCoarticulation(tokens, weights);
    const semivowelDur = frames[0].timeEnd - frames[0].timeStart;
    const monoDur = frames[1].timeEnd - frames[1].timeStart;
    expect(semivowelDur).toBeCloseTo(monoDur, 5); // 각각 0.2초
  });

  it('단모음 프레임: ㅑ의 기저음 ㅏ → lipModel=L1', () => {
    const tokens = [vowel('ㅑ', 0, 0.4)];
    const weights = calculatePhraseWeights(tokens);
    const frames = applyCoarticulation(tokens, weights);
    expect(frames[1].lipModel).toBe('L1'); // 기저음 ㅏ → L1
  });
});

describe('규칙 12: 짧은 쉼 생략', () => {
  it('0.3초 pause → 프레임 생성 안 됨', () => {
    const tokens = [
      vowel('ㅏ', 0, 0.2),
      pause(0.2, 0.5), // 0.3초
      vowel('ㅣ', 0.5, 0.7),
    ];
    const weights = calculatePhraseWeights(tokens);
    const frames = applyCoarticulation(tokens, weights);
    const pauseFrames = frames.filter(f => f.timeStart >= 0.2 && f.timeEnd <= 0.5);
    expect(pauseFrames).toHaveLength(0);
  });

  it('0.5초 pause → 중립 프레임 생성', () => {
    const tokens = [
      vowel('ㅏ', 0, 0.2),
      pause(0.2, 0.7), // 0.5초
      vowel('ㅣ', 0.7, 0.9),
    ];
    const weights = calculatePhraseWeights(tokens);
    const frames = applyCoarticulation(tokens, weights);
    const pauseFrames = frames.filter(f => f.timeStart >= 0.2 && f.timeEnd <= 0.7);
    expect(pauseFrames).toHaveLength(1);
    expect(pauseFrames[0].lipWeight).toBe(0.0);
  });
});

// ── fillConsonantLips ───────────────────────────────────────

describe('fillConsonantLips (스플라인 보간)', () => {
  it('lipModel=null인 프레임이 보간 후 채워짐', () => {
    const frames: VisemeFrame[] = [
      { timeStart: 0,    timeEnd: 0.2,  lipModel: 'L1', tongueModel: 'VT2', lipWeight: 0.8, tongueWeight: 0.8 },
      { timeStart: 0.2,  timeEnd: 0.35, lipModel: null, tongueModel: 'T1',  lipWeight: 0,   tongueWeight: 0.8 },
      { timeStart: 0.35, timeEnd: 0.55, lipModel: 'L7', tongueModel: 'VT1', lipWeight: 0.9, tongueWeight: 0.9 },
    ];
    const result = fillConsonantLips(frames);
    expect(result[1].lipModel).not.toBeNull();
    expect(result[1].lipWeight).toBeGreaterThan(0);
  });

  it('앞 모음만 있는 경우: 앞 모음 모델 참조', () => {
    const frames: VisemeFrame[] = [
      { timeStart: 0,   timeEnd: 0.2,  lipModel: 'L4', tongueModel: 'VT4', lipWeight: 0.7, tongueWeight: 0.7 },
      { timeStart: 0.2, timeEnd: 0.35, lipModel: null, tongueModel: 'T2',  lipWeight: 0,   tongueWeight: 0.8 },
    ];
    const result = fillConsonantLips(frames);
    expect(result[1].lipModel).toBe('L4');
  });

  it('모음 프레임은 변경 없음', () => {
    const frames: VisemeFrame[] = [
      { timeStart: 0, timeEnd: 0.3, lipModel: 'L1', tongueModel: 'VT2', lipWeight: 0.9, tongueWeight: 0.9 },
    ];
    const result = fillConsonantLips(frames);
    expect(result[0].lipModel).toBe('L1');
    expect(result[0].lipWeight).toBe(0.9);
  });
});

// ── mapToVisemes 통합 검증 ──────────────────────────────────

describe('mapToVisemes 통합 (아버지)', () => {
  // 아버지: [ㅇ, ㅏ, ㅂ, ㅓ, ㅈ, ㅣ]
  const tokens: PhonemeToken[] = [
    { jamo: 'ㅇ', position: 'onset', start: 0.0,  end: 0.12, duration: 0.12, intensity: 0,   isVowel: false, isPause: false, isDiphthong: false },
    { jamo: 'ㅏ', position: 'nucleus', start: 0.12, end: 0.25, duration: 0.13, intensity: 0.7, isVowel: true,  isPause: false, isDiphthong: false },
    { jamo: 'ㅂ', position: 'onset', start: 0.25, end: 0.40, duration: 0.15, intensity: 0,   isVowel: false, isPause: false, isDiphthong: false },
    { jamo: 'ㅓ', position: 'nucleus', start: 0.40, end: 0.55, duration: 0.15, intensity: 0.6, isVowel: true,  isPause: false, isDiphthong: false },
    { jamo: 'ㅈ', position: 'onset', start: 0.55, end: 0.68, duration: 0.13, intensity: 0,   isVowel: false, isPause: false, isDiphthong: false },
    { jamo: 'ㅣ', position: 'nucleus', start: 0.68, end: 0.85, duration: 0.17, intensity: 0.5, isVowel: true,  isPause: false, isDiphthong: false },
  ];

  it('6개 토큰 → 6개 VisemeFrame 생성', () => {
    const frames = mapToVisemes(tokens);
    expect(frames).toHaveLength(6);
  });

  it('모든 프레임의 lipModel이 채워져 있음 (null 없음)', () => {
    const frames = mapToVisemes(tokens);
    expect(frames.every(f => f.lipModel !== null)).toBe(true);
  });

  it('ㅏ 모음 프레임: lipModel=L1', () => {
    const frames = mapToVisemes(tokens);
    const aFrame = frames.find(f => f.timeStart >= 0.12 && f.timeStart < 0.25);
    expect(aFrame?.lipModel).toBe('L1');
  });

  it('ㅂ 자음 프레임: 규칙 7 적용 → lipModel=L9, lipWeight=1.0', () => {
    const frames = mapToVisemes(tokens);
    const bFrame = frames.find(f => f.timeStart >= 0.25 && f.timeStart < 0.40);
    expect(bFrame?.lipModel).toBe('L9');
    expect(bFrame?.lipWeight).toBe(1.0);
  });

  it('ㅣ 모음 프레임: lipModel=L7', () => {
    const frames = mapToVisemes(tokens);
    const iFrame = frames.find(f => f.timeStart >= 0.68);
    expect(iFrame?.lipModel).toBe('L7');
  });

  it('모든 프레임 시간이 순서대로 정렬됨', () => {
    const frames = mapToVisemes(tokens);
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i].timeStart).toBeGreaterThanOrEqual(frames[i-1].timeStart);
    }
  });
});
