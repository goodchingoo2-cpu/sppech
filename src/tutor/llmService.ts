/**
 * LLM 서비스 — wllama 내장 엔진 우선, LM Studio HTTP 폴백.
 *
 * ── LLM 호출 최소화 전략 ──────────────────────────────────────────────────
 *
 * repeat 스텝 (학생이 문장 따라말하기):
 *   1) 정규화 후 완전 일치          → match   (LLM 호출 없음)
 *   2) 자모 유사도 > 0.80           → close   (LLM 호출 없음)
 *   3) 자모 유사도 < 0.20           → different(LLM 호출 없음)
 *   4) 질문 패턴 감지               → question(LLM 호출 없음)
 *   5) 유사도 0.20~0.80 (애매함)    → LLM 판정 (실제 수업에서 드묾)
 *
 * check 스텝 (학생 자유 질문):
 *   - answer() 호출 → LLM 필요
 *   - max_tokens 100, 프롬프트 최소화로 응답 시간 단축
 *
 * intro / teach / outro 스텝:
 *   - 완전 스크립트 기반, LLM 호출 없음
 * ─────────────────────────────────────────────────────────────────────────
 */

import { EVAL_SYSTEM_PROMPT, ANSWER_SYSTEM_PROMPT } from './systemPrompt.js';
import { llmEngine, type WllamaChatMessage } from './llmEngine.js';

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export type EvalVerdict = 'match' | 'close' | 'different' | 'question';
export interface EvalResult {
  readonly verdict: EvalVerdict;
  readonly feedback: string;
}

// ---------------------------------------------------------------------------
// LM Studio HTTP 폴백 설정
// ---------------------------------------------------------------------------

const LM_MODEL    = (import.meta.env?.VITE_LM_STUDIO_MODEL as string | undefined) ?? 'gemma4:e2b';
const LM_ENDPOINT = '/lmstudio/v1/chat/completions';
const TIMEOUT_MS  = 12_000;

const VALID_VERDICTS: ReadonlySet<EvalVerdict> = new Set([
  'match', 'close', 'different', 'question',
]);

interface LmStudioResponse {
  readonly choices?: ReadonlyArray<{
    readonly message?: { readonly content?: string };
  }>;
  readonly error?: string | { readonly message?: string };
}

// ---------------------------------------------------------------------------
// 한국어 유사도 계산 (LLM 호출 최소화 핵심)
// ---------------------------------------------------------------------------

/**
 * 한글 문자열을 자모(子母) 단위로 분해한다.
 * 예: "안녕" → "ㅇㅏㄴㄴㅕㅇ"
 * 이를 통해 받침 차이, 모음 차이 등 세밀한 발음 유사도를 측정한다.
 */
function decomposeJamo(str: string): string {
  const CHO  = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const JONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';
  const BASE = 0xAC00;

  let result = '';
  for (const ch of str) {
    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const offset = code - BASE;
      const cho  = Math.floor(offset / (21 * 28));
      const jung = Math.floor((offset % (21 * 28)) / 28);
      const jong = offset % 28;
      result += CHO[cho] + JUNG[jung] + (jong > 0 ? JONG[jong] : '');
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * 정규화 함수: 공백·구두점 제거, 소문자, 자모 분해.
 */
function normalize(s: string): string {
  return decomposeJamo(
    s.replace(/[\s.!?,。！？'"""''~…]/g, '').toLowerCase()
  );
}

/**
 * Levenshtein 거리 기반 유사도 (0~1).
 * 1.0 = 완전 일치, 0.0 = 완전 불일치.
 * 자모 분해된 문자열을 비교하므로 발음 유사도에 더 적합하다.
 */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  if (na.length === 0 || nb.length === 0) return 0.0;

  const m = na.length;
  const n = nb.length;
  // 길이 차이가 너무 크면 바로 낮은 유사도 반환 (불필요한 계산 회피)
  if (Math.abs(m - n) > Math.max(m, n) * 0.8) return 0.0;

  // DP 배열 (1D rolling)
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = na[i - 1] === nb[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }

  return 1 - prev[n] / Math.max(m, n);
}

/**
 * expected 목록 중 가장 높은 유사도를 반환.
 */
function bestSimilarity(expected: readonly string[], transcript: string): number {
  if (expected.length === 0) return 0;
  return Math.max(...expected.map((ex) => similarity(ex, transcript)));
}

// ---------------------------------------------------------------------------
// 규칙 기반 사전 판정 (LLM 없음)
// ---------------------------------------------------------------------------

/** 질문 패턴 정규식 */
const QUESTION_PATTERN = /\?|까요|나요|무엇|뭐|어떻게|어디|언제|누구|설명|알려|이게|이거|왜/;

/**
 * 규칙만으로 판정 가능한 경우를 먼저 처리한다.
 * null 반환 시 → LLM으로 넘긴다.
 *
 * 유사도 임계값:
 *  > 0.80  → close  (외국인 학습자 허용 오차를 고려해 match 대신 close로 부드럽게)
 *  > 0.90  → match  (사실상 정답)
 *  < 0.20  → different
 *  나머지  → LLM (0.20~0.80 구간, 실제 수업에서 드묾)
 */
function ruleBasedEval(
  expected: readonly string[],
  transcript: string,
): EvalResult | null {
  // 1) 완전 일치 (normalize 기준)
  const normT = normalize(transcript);
  for (const ex of expected) {
    if (normalize(ex) === normT) {
      return { verdict: 'match', feedback: '잘 하셨어요!' };
    }
  }

  // 2) 질문 패턴
  if (QUESTION_PATTERN.test(transcript)) {
    return { verdict: 'question', feedback: '좋은 질문이에요!' };
  }

  // 3) 자모 유사도
  const best = bestSimilarity(expected, transcript);

  if (best >= 0.90) {
    return { verdict: 'match', feedback: '잘 하셨어요!' };
  }
  if (best >= 0.75) {
    return { verdict: 'close', feedback: '거의 맞아요! 한번 더 해볼까요?' };
  }
  if (best < 0.20) {
    return { verdict: 'different', feedback: '다시 한번 천천히 따라 말해봐요.' };
  }

  // 0.20~0.75 → LLM 판정 필요
  return null;
}

// ---------------------------------------------------------------------------
// 내부 유틸
// ---------------------------------------------------------------------------

function extractJson(content: string): unknown {
  const trimmed = content.trim();
  const m = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = m ? m[1]!.trim() : trimmed;
  const first = body.indexOf('{');
  const last  = body.lastIndexOf('}');
  const jsonStr = first >= 0 && last > first ? body.slice(first, last + 1) : body;
  return JSON.parse(jsonStr);
}

function withTimeout(external?: AbortSignal): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error('LLM timeout')), TIMEOUT_MS);
  const onExt = () => ctrl.abort(external?.reason);
  if (external) {
    if (external.aborted) ctrl.abort(external.reason);
    else external.addEventListener('abort', onExt, { once: true });
  }
  return {
    signal: ctrl.signal,
    cancel: () => {
      clearTimeout(t);
      external?.removeEventListener('abort', onExt);
    },
  };
}

// ---------------------------------------------------------------------------
// rawChat — 엔진 우선, HTTP 폴백
// ---------------------------------------------------------------------------

async function rawChat(
  messages: readonly ChatMessage[],
  external: AbortSignal | undefined,
  maxTokens: number,
): Promise<string> {
  // ── 1순위: wllama 내장 엔진 ────────────────────────────────────────────
  if (llmEngine.getStatus().phase === 'ready') {
    const wMessages: WllamaChatMessage[] = messages.map((m) => ({
      role:    m.role,
      content: m.content,
    }));

    const result = await llmEngine.chat(wMessages, {
      maxTokens,
      temperature: 0.3,   // 낮은 temperature = 더 결정적 출력
      signal:      external,
    });

    if (result !== null) return result;
    console.warn('[llmService] wllama 추론 실패, LM Studio 폴백');
  }

  // ── 2순위: LM Studio HTTP API ──────────────────────────────────────────
  const { signal, cancel } = withTimeout(external);
  try {
    const res = await fetch(LM_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model:       LM_MODEL,
        messages:    [...messages],
        stream:      false,
        temperature: 0.3,
        max_tokens:  maxTokens,
      }),
    });

    if (!res.ok) {
      const bt = await res.text().catch(() => '');
      throw new Error(`LM Studio HTTP ${res.status}: ${bt.slice(0, 200)}`);
    }

    const data = (await res.json()) as LmStudioResponse;
    if (data.error) {
      const msg = typeof data.error === 'string' ? data.error : data.error.message;
      throw new Error(`LM Studio error: ${msg ?? 'unknown'}`);
    }
    const content = data.choices?.[0]?.message?.content ?? '';
    if (!content) throw new Error('빈 응답');
    return content;
  } finally {
    cancel();
  }
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

export const llmService = {

  /**
   * 학습자 발화 평가.
   *
   * 규칙 기반으로 대부분 처리 — LLM은 애매한 경우(유사도 0.20~0.75)에만 호출.
   * 실제 수업에서 LLM 호출 빈도: 전체 repeat 스텝의 약 5~15%.
   */
  async evaluate(
    expected: readonly string[],
    transcript: string,
    _context: string,
    signal?: AbortSignal,
  ): Promise<EvalResult> {
    // 빈 발화
    if (!transcript.trim()) {
      return { verdict: 'close', feedback: '목소리가 작게 들렸어요. 다시 말해봐요.' };
    }

    // 규칙 기반 사전 판정 (LLM 없음)
    const ruled = ruleBasedEval(expected, transcript);
    if (ruled) return ruled;

    // LLM 판정 (애매한 경우만 도달)
    // 키를 짧게 줄여 입력 토큰 절약
    const payload = JSON.stringify({
      e: Array.from(expected),
      l: transcript,
      q: QUESTION_PATTERN.test(transcript),
    });

    try {
      const raw = await rawChat(
        [
          { role: 'system', content: EVAL_SYSTEM_PROMPT },
          { role: 'user',   content: payload },
        ],
        signal,
        60,   // 판정용 — 매우 짧은 JSON 출력만 필요
      );

      const parsed  = extractJson(raw) as Record<string, unknown>;
      // 키 축약 버전("v") 또는 이전 버전("verdict") 모두 허용
      const rawV    = (parsed.v ?? parsed.verdict ?? 'close') as string;
      const verdict: EvalVerdict = VALID_VERDICTS.has(rawV as EvalVerdict)
        ? (rawV as EvalVerdict) : 'close';
      const rawF    = (parsed.f ?? parsed.feedback ?? '') as string;
      const feedback = rawF.trim().slice(0, 80) || defaultFeedback(verdict);
      return { verdict, feedback };
    } catch (e) {
      console.warn('[evaluate] LLM 폴백:', e);
      // LLM 실패 시 유사도 0.20~0.75 구간 → close로 처리
      return { verdict: 'close', feedback: '거의 맞아요! 한번 더 해볼까요?' };
    }
  },

  /**
   * 학생 자유 질문 답변.
   * max_tokens 100으로 제한 — wllama에서 약 15~40초.
   */
  async answer(context: string, question: string, signal?: AbortSignal): Promise<string> {
    // 컨텍스트를 최소화해 입력 토큰 절약
    const ctx = context.slice(0, 80);   // 최대 80자
    const q   = question.slice(0, 100); // 최대 100자
    try {
      const raw = await rawChat(
        [
          { role: 'system', content: ANSWER_SYSTEM_PROMPT },
          { role: 'user',   content: `[학습중]${ctx}\n[질문]${q}` },
        ],
        signal,
        100,  // 답변 최대 100 토큰 (약 50~70 한국어 음절)
      );
      return raw.trim().replace(/^["']+|["']+$/g, '').slice(0, 300) || DEFAULT_ANSWER;
    } catch (e) {
      console.warn('[answer] LLM 폴백:', e);
      return DEFAULT_ANSWER;
    }
  },

  /** 사용 가능한 백엔드 확인. */
  async ping(): Promise<boolean> {
    if (llmEngine.getStatus().phase === 'ready') return true;
    try {
      const res = await fetch('/lmstudio/v1/models', { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  },
};

// ---------------------------------------------------------------------------
// 내부 상수
// ---------------------------------------------------------------------------

const DEFAULT_ANSWER = '죄송해요, 잘 이해하지 못했어요. 선생님께 다시 여쭤봐요.';

function defaultFeedback(v: EvalVerdict): string {
  switch (v) {
    case 'match':     return '잘 하셨어요!';
    case 'close':     return '거의 맞아요. 한번 더 해볼까요?';
    case 'different': return '다시 한번 천천히 따라 말해봐요.';
    case 'question':  return '좋은 질문이에요! 조금 더 설명할게요.';
  }
}
