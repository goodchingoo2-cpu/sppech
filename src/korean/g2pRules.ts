// ============================================================
// G2P 규칙 엔진 (가이드 §2.1, 규칙 1~4)
//
// 역할:
//   1. 음소 위치 배정  — onset/nucleus/coda 태그 부여
//   2. 연음 규칙 3종   — 종성이 다음 음절 초성으로 이동
//   3. 자음 음운 규칙  — 비음화, 유음화, 격음화, 구개음화 등
//
// 가이드 명시 제외 항목:
//   - 경음화(tensification): 시각적 차이 없음 → SKIP_VISUAL 처리
// ============================================================

import type { PhonemeToken, PhonemePosition } from '../input/types.js';

// ── 자음 분류 집합 ──────────────────────────────────────────

const VELAR_STOPS   = new Set(['ㄱ', 'ㄲ', 'ㅋ']);
const DENTAL_STOPS  = new Set(['ㄷ', 'ㄸ', 'ㅌ', 'ㅅ', 'ㅆ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅎ']);
const BILABIAL_STOPS = new Set(['ㅂ', 'ㅃ', 'ㅍ']);
const NASALS        = new Set(['ㄴ', 'ㅁ', 'ㅇ']);
const LIQUIDS       = new Set(['ㄹ']);

/** 겹받침 → 대표 단자음 매핑 (자음군 단순화) */
const CLUSTER_SIMPLIFICATION: Record<string, string> = {
  'ㄳ': 'ㄱ',  // ㄱ+ㅅ → ㄱ (삶 제외)
  'ㄵ': 'ㄴ',  // ㄴ+ㅈ → ㄴ
  'ㄶ': 'ㄴ',  // ㄴ+ㅎ → ㄴ
  'ㄺ': 'ㄱ',  // ㄹ+ㄱ → ㄱ (단, 밟다 계열 예외)
  'ㄻ': 'ㄹ',  // ㄹ+ㅁ → ㄹ
  'ㄼ': 'ㄹ',  // ㄹ+ㅂ → ㄹ (단, 밟- 계열 → ㅂ)
  'ㄽ': 'ㄹ',  // ㄹ+ㅅ → ㄹ
  'ㄾ': 'ㄹ',  // ㄹ+ㅌ → ㄹ
  'ㄿ': 'ㅂ',  // ㄹ+ㅍ → ㅂ
  'ㅀ': 'ㄹ',  // ㄹ+ㅎ → ㄹ
  'ㅄ': 'ㅂ',  // ㅂ+ㅅ → ㅂ
};

/** 격음화: 평음 + ㅎ (또는 ㅎ + 평음) → 격음 */
const ASPIRATION_MAP: Record<string, string> = {
  'ㄱ': 'ㅋ', 'ㄷ': 'ㅌ', 'ㅂ': 'ㅍ', 'ㅈ': 'ㅊ',
};

// ── PhonemeToken 복제 헬퍼 ─────────────────────────────────

function cloneToken(t: PhonemeToken, overrides: Partial<PhonemeToken> = {}): PhonemeToken {
  return { ...t, ...overrides };
}

/**
 * index i 이후의 첫 번째 비-pause 토큰 인덱스 반환
 * pause를 건너뛰고 음운론적 이웃을 탐색할 때 사용
 */
function nextNonPause(tokens: PhonemeToken[], from: number): number {
  for (let j = from; j < tokens.length; j++) {
    if (!tokens[j].isPause) return j;
  }
  return -1;
}

// ============================================================
// Step 1: 음소 위치 배정
// 패턴: [C*] V [C*] V … 에서
//   V 앞 자음(군): 마지막은 onset, 나머지는 coda (이전 음절)
//   마지막 V 뒤 자음(군): 모두 coda
// ============================================================

export function assignPositions(tokens: PhonemeToken[]): PhonemeToken[] {
  const result = tokens.map(t => cloneToken(t));

  // 모음 인덱스 목록
  const vowelIdx: number[] = [];
  result.forEach((t, i) => {
    if (t.isVowel) vowelIdx.push(i);
  });

  if (vowelIdx.length === 0) {
    // 모음 없음 — 전부 onset 처리
    return result.map(t => cloneToken(t, { position: t.isPause ? 'pause' : 'onset' }));
  }

  // 각 모음의 position = nucleus
  for (const vi of vowelIdx) {
    result[vi] = cloneToken(result[vi], { position: 'nucleus' });
  }

  // 각 모음 사이 자음 배분
  for (let k = 0; k < vowelIdx.length; k++) {
    const vIdx = vowelIdx[k];
    const prevVIdx = k > 0 ? vowelIdx[k - 1] : -1;

    // prevVIdx+1 ~ vIdx-1 사이의 비 pause 자음들
    const consBefore: number[] = [];
    for (let j = prevVIdx + 1; j < vIdx; j++) {
      if (!result[j].isPause && !result[j].isVowel) consBefore.push(j);
    }

    if (consBefore.length === 0) {
      // 자음 없음: 초성 ㅇ 위치 (이미 T6로 처리)
    } else if (consBefore.length === 1) {
      // 단일 자음: 이 모음의 onset
      result[consBefore[0]] = cloneToken(result[consBefore[0]], { position: 'onset' });
    } else {
      // 복수 자음: 마지막 = 이 모음의 onset, 나머지 = 이전 모음의 coda
      for (let c = 0; c < consBefore.length - 1; c++) {
        result[consBefore[c]] = cloneToken(result[consBefore[c]], { position: 'coda' });
      }
      result[consBefore[consBefore.length - 1]] = cloneToken(
        result[consBefore[consBefore.length - 1]],
        { position: 'onset' }
      );
    }
  }

  // 마지막 모음 이후 자음 → coda
  const lastVIdx = vowelIdx[vowelIdx.length - 1];
  for (let j = lastVIdx + 1; j < result.length; j++) {
    if (!result[j].isPause) {
      result[j] = cloneToken(result[j], { position: 'coda' });
    }
  }

  return result;
}

// ============================================================
// Step 2: 자음군 단순화 (Cluster Simplification)
// 겹받침을 단자음으로 변환 (coda 위치에서만 적용)
// ============================================================

export function applyClusterSimplification(tokens: PhonemeToken[]): PhonemeToken[] {
  return tokens.map(t => {
    if (t.position !== 'coda') return t;
    const simplified = CLUSTER_SIMPLIFICATION[t.jamo];
    if (!simplified) return t;
    return cloneToken(t, { jamo: simplified });
  });
}

// ============================================================
// Step 3: 연음 규칙 3종 (가이드 §2.1 연음 규칙)
// 종성 + 초성ㅇ → 종성 이동
// ============================================================

/**
 * 연음1: 단순 연음
 * 종성 C + 초성 ㅇ → 종성이 다음 음절의 초성으로 이동
 * 예) 닭이 → [ㄷ,ㅏ,ㄹ,ㄱ(onset),ㅣ] (ㄱ이 coda에서 onset으로)
 */
export function applyLiaison(tokens: PhonemeToken[]): PhonemeToken[] {
  const result = tokens.map(t => cloneToken(t));

  for (let i = 0; i < result.length; i++) {
    const curr = result[i];
    if (curr.position !== 'coda' || curr.isPause) continue;

    const ni = nextNonPause(result, i + 1);
    if (ni === -1) continue;
    const next = result[ni];

    if (next.position === 'onset' && next.jamo === 'ㅇ' && !next.isPause) {
      // coda 자음을 다음 음절의 onset으로 이동
      result[ni] = cloneToken(next, { jamo: curr.jamo, position: 'onset' });
      result[i] = cloneToken(curr, { jamo: '' });
    }
  }

  return result.filter(t => t.jamo !== '' || t.isVowel || t.isPause);
}

/**
 * 연음2: 겹받침 연음
 * 겹받침(첫째 자음 유지, 둘째 자음이 다음 초성으로)
 * 예) 닭을 → 달글 (ㄺ → ㄹ coda + ㄱ을 next onset으로)
 * 자음군 단순화 후에는 이미 분리되어 있으므로 Step2 이후 처리 불필요
 * (MFA는 이미 표면형을 줌)
 */
export function applyClusterLiaison(tokens: PhonemeToken[]): PhonemeToken[] {
  // MFA 표면형 기준으로는 이미 처리됨
  // 이 함수는 향후 기저형 입력 지원 시 확장용
  return tokens;
}

/**
 * 연음3: ㅎ 연음 (ㅎ + 모음 → ㅎ 탈락)
 * 예) 좋아 → 조아 (coda ㅎ + onset ㅇ 연음 시 ㅎ 탈락)
 */
export function applyHLiaison(tokens: PhonemeToken[]): PhonemeToken[] {
  const result = tokens.map(t => cloneToken(t));

  for (let i = 0; i < result.length; i++) {
    const curr = result[i];
    if (curr.position !== 'coda' || curr.jamo !== 'ㅎ') continue;

    const ni = nextNonPause(result, i + 1);
    if (ni === -1) continue;
    const next = result[ni];

    // coda ㅎ + onset ㅇ → ㅎ 탈락
    if (next.position === 'onset' && next.jamo === 'ㅇ') {
      result[i] = cloneToken(curr, { jamo: '' });
    }
  }

  return result.filter(t => t.jamo !== '' || t.isVowel || t.isPause);
}

// ============================================================
// Step 4: 자음 음운 규칙 (coda → onset 경계에서 적용)
// ============================================================

/**
 * 비음화 (Nasalization)
 * 폐쇄음 coda + 비음 onset → 비음 coda + 비음 onset
 *   ㄱ/ㄲ/ㅋ + ㄴ/ㅁ → ㅇ + ㄴ/ㅁ
 *   ㄷ/ㄸ/ㅅ/ㅆ/ㅈ/ㅉ/ㅊ/ㅌ/ㅎ + ㄴ/ㅁ → ㄴ + ㄴ/ㅁ
 *   ㅂ/ㅃ/ㅍ + ㄴ/ㅁ → ㅁ + ㄴ/ㅁ
 * 예) 국민 → 궁민, 맏며느리 → 만며느리, 십만 → 심만
 */
export function applyNasalization(tokens: PhonemeToken[]): PhonemeToken[] {
  const result = tokens.map(t => cloneToken(t));

  for (let i = 0; i < result.length; i++) {
    const curr = result[i];
    if (curr.position !== 'coda' || curr.isPause) continue;

    const ni = nextNonPause(result, i + 1);
    if (ni === -1) continue;
    const next = result[ni];

    if (next.position !== 'onset') continue;
    if (!NASALS.has(next.jamo) || next.jamo === 'ㅇ') continue; // ㅇ은 음가 없음

    if (VELAR_STOPS.has(curr.jamo)) {
      result[i] = cloneToken(curr, { jamo: 'ㅇ' });
    } else if (DENTAL_STOPS.has(curr.jamo)) {
      result[i] = cloneToken(curr, { jamo: 'ㄴ' });
    } else if (BILABIAL_STOPS.has(curr.jamo)) {
      result[i] = cloneToken(curr, { jamo: 'ㅁ' });
    }
  }

  return result;
}

/**
 * 유음화 (Lateralization)
 * ㄴ coda + ㄹ onset → ㄹ coda + ㄹ onset
 * ㄹ coda + ㄴ onset → ㄹ coda + ㄹ onset
 * 예) 신라 → 실라, 칼날 → 칼랄
 */
export function applyLateralization(tokens: PhonemeToken[]): PhonemeToken[] {
  const result = tokens.map(t => cloneToken(t));

  for (let i = 0; i < result.length; i++) {
    const curr = result[i];
    if (curr.position !== 'coda' || curr.isPause) continue;

    const ni = nextNonPause(result, i + 1);
    if (ni === -1) continue;
    const next = result[ni];

    if (next.position !== 'onset') continue;

    if (curr.jamo === 'ㄴ' && next.jamo === 'ㄹ') {
      result[i] = cloneToken(curr, { jamo: 'ㄹ' });
    } else if (curr.jamo === 'ㄹ' && next.jamo === 'ㄴ') {
      result[ni] = cloneToken(next, { jamo: 'ㄹ' });
    }
  }

  return result;
}

/**
 * 격음화 (Aspiration)
 * 평음 coda + ㅎ onset → 격음 onset (coda 삭제)
 * ㅎ coda + 평음 onset → 격음 onset (coda 삭제)
 * 예) 좋고 → 조코, 입학 → 이팍, 먹히다 → 머키다
 */
export function applyAspiration(tokens: PhonemeToken[]): PhonemeToken[] {
  const result = tokens.map(t => cloneToken(t));

  for (let i = 0; i < result.length; i++) {
    const curr = result[i];
    if (curr.position !== 'coda' || curr.isPause) continue;

    const ni = nextNonPause(result, i + 1);
    if (ni === -1) continue;
    const next = result[ni];

    if (next.position !== 'onset') continue;

    if (curr.jamo === 'ㅎ' && ASPIRATION_MAP[next.jamo]) {
      // ㅎ coda + 평음 onset → 격음
      result[i] = cloneToken(curr, { jamo: '' });
      result[ni] = cloneToken(next, { jamo: ASPIRATION_MAP[next.jamo] });
    } else if (next.jamo === 'ㅎ' && ASPIRATION_MAP[curr.jamo]) {
      // 평음 coda + ㅎ onset → 격음
      result[i] = cloneToken(curr, { jamo: '' });
      result[ni] = cloneToken(next, {
        jamo: ASPIRATION_MAP[curr.jamo],
        position: 'onset',
      });
    }
  }

  return result.filter(t => t.jamo !== '' || t.isVowel || t.isPause);
}

/**
 * 구개음화 (Palatalization)
 * ㄷ coda + ㅣ onset 모음 → ㅈ onset
 * ㅌ coda + ㅣ onset 모음 → ㅊ onset
 * 예) 해돋이 → 해도지, 같이 → 가치
 *
 * 주의: coda 다음이 onset ㅇ + ㅣ모음 구조일 때 적용
 * 실질적으로 MFA에서는 [ㄷ, ㅣ] 경계에서 처리
 */
export function applyPalatalization(tokens: PhonemeToken[]): PhonemeToken[] {
  const result = tokens.map(t => cloneToken(t));

  const I_VOWELS = new Set(['ㅣ', 'ㅑ', 'ㅕ', 'ㅛ', 'ㅠ', 'ㅒ', 'ㅖ', 'ㅢ']);

  for (let i = 0; i < result.length; i++) {
    const curr = result[i];
    if (curr.position !== 'coda') continue;

    const ni = nextNonPause(result, i + 1);
    if (ni === -1) continue;
    const next = result[ni];

    // coda ㄷ/ㅌ + 바로 다음이 ㅣ계 모음인 경우 (연음 후 onset 없는 구조)
    if (next.isVowel && I_VOWELS.has(next.jamo)) {
      if (curr.jamo === 'ㄷ') {
        result[i] = cloneToken(curr, { jamo: 'ㅈ', position: 'onset' });
      } else if (curr.jamo === 'ㅌ') {
        result[i] = cloneToken(curr, { jamo: 'ㅊ', position: 'onset' });
      }
      continue;
    }

    // coda + onset ㅇ + ㅣ계 모음 패턴 (pause 건너뜀)
    if (next.position === 'onset' && next.jamo === 'ㅇ') {
      const vi = nextNonPause(result, ni + 1);
      if (vi !== -1 && result[vi].isVowel && I_VOWELS.has(result[vi].jamo)) {
        if (curr.jamo === 'ㄷ') {
          result[i] = cloneToken(curr, { jamo: '' });
          result[ni] = cloneToken(next, { jamo: 'ㅈ', position: 'onset' });
        } else if (curr.jamo === 'ㅌ') {
          result[i] = cloneToken(curr, { jamo: '' });
          result[ni] = cloneToken(next, { jamo: 'ㅊ', position: 'onset' });
        }
      }
    }
  }

  return result.filter(t => t.jamo !== '' || t.isVowel || t.isPause);
}

/**
 * 경음화 (Tensification) — 시각적 차이 없음
 * 가이드 명시: 시각적 최적화를 위해 계산에서 제외
 * 이 함수는 변환 없이 그대로 반환 (SKIP_VISUAL)
 */
export function applyTensification(tokens: PhonemeToken[]): PhonemeToken[] {
  // SKIP_VISUAL: 경음화는 혀/입술 모양에 시각적 차이 없음
  return tokens;
}

// ============================================================
// 메인 진입점: 모든 규칙 순서대로 적용
// ============================================================

export interface G2POptions {
  /** 음운구 경계 pause 임계값 (초, 기본 0.4) */
  pauseThreshold?: number;
}

/**
 * 하나의 음운구(phrase) 내 토큰에 모든 G2P 규칙 적용
 * 규칙 적용 순서 (우선순위 순):
 *   1. 위치 배정 (assignPositions)
 *   2. 자음군 단순화 (applyClusterSimplification)
 *   3. 격음화 (applyAspiration) — ㅎ 관련은 최우선
 *   4. ㅎ 연음 (applyHLiaison)
 *   5. 연음 (applyLiaison)
 *   6. 비음화 (applyNasalization)
 *   7. 유음화 (applyLateralization)
 *   8. 구개음화 (applyPalatalization)
 *   9. 경음화 (applyTensification) — SKIP_VISUAL
 */
export function applyG2PRules(phraseTokens: PhonemeToken[]): PhonemeToken[] {
  let tokens = assignPositions(phraseTokens);
  tokens = applyClusterSimplification(tokens);
  tokens = applyAspiration(tokens);
  tokens = applyHLiaison(tokens);
  tokens = applyLiaison(tokens);
  tokens = applyNasalization(tokens);
  tokens = applyLateralization(tokens);
  tokens = applyPalatalization(tokens);
  tokens = applyTensification(tokens); // SKIP_VISUAL
  return tokens;
}

/**
 * 전체 토큰 배열을 음운구 단위로 분리하여 G2P 규칙 적용 후 재합성
 * pause(≥ pauseThreshold)는 음운구 경계로 처리 (가이드 §2.1)
 */
export function applyG2PRulesAll(
  tokens: PhonemeToken[],
  options: G2POptions = {}
): PhonemeToken[] {
  const threshold = options.pauseThreshold ?? 0.4;
  const result: PhonemeToken[] = [];
  let phrase: PhonemeToken[] = [];

  const flushPhrase = () => {
    if (phrase.length > 0) {
      result.push(...applyG2PRules(phrase));
      phrase = [];
    }
  };

  for (const token of tokens) {
    if (token.isPause && token.duration >= threshold) {
      flushPhrase();
      result.push(token); // pause 자체는 그대로 보존
    } else {
      phrase.push(token);
    }
  }

  flushPhrase();
  return result;
}
