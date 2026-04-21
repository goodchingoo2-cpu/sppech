/**
 * LLM 서비스 — wllama 내장 엔진 우선, LM Studio HTTP API 폴백.
 *
 * 동작 우선순위:
 *   1순위 — llmEngine (wllama / Gemma 4 E2B GGUF, 브라우저 내장)
 *   2순위 — LM Studio HTTP API (엔진이 아직 로드 안 됐거나 실패 시 폴백)
 *
 * 외부에서 보이는 API(evaluate / answer / ping)는 그대로 유지된다.
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

/** 학습자 답변 평가 결과. */
export type EvalVerdict = 'match' | 'close' | 'different' | 'question';
export interface EvalResult {
  readonly verdict: EvalVerdict;
  /** 튜터가 학습자에게 건네는 짧은 피드백 문장. */
  readonly feedback: string;
}

// ---------------------------------------------------------------------------
// LM Studio HTTP 폴백 설정
// ---------------------------------------------------------------------------

const LM_MODEL    = (import.meta.env?.VITE_LM_STUDIO_MODEL as string | undefined) ?? 'gemma4:e2b';
const LM_ENDPOINT = '/lmstudio/v1/chat/completions';
const TIMEOUT_MS  = 15_000;

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
// 내부 유틸
// ---------------------------------------------------------------------------

/** 마크다운/코드블록 래퍼 제거 후 순수 JSON 파싱. */
function extractJson(content: string): unknown {
  const trimmed = content.trim();
  const m = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = m ? m[1]!.trim() : trimmed;
  const first = body.indexOf('{');
  const last  = body.lastIndexOf('}');
  const jsonStr = first >= 0 && last > first ? body.slice(first, last + 1) : body;
  return JSON.parse(jsonStr);
}

/** AbortController + 타임아웃 결합. */
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
  useJsonHint: boolean,
): Promise<string> {
  // ── 1순위: wllama 내장 엔진 ────────────────────────────────────────────
  const engineStatus = llmEngine.getStatus();
  if (engineStatus.phase === 'ready') {
    const wMessages: WllamaChatMessage[] = messages.map((m) => ({
      role:    m.role,
      content: m.content,
    }));
    if (useJsonHint) {
      wMessages.push({
        role:    'user',
        content: 'Return only a valid JSON object. Do not include markdown.',
      });
    }

    const result = await llmEngine.chat(wMessages, {
      maxTokens:   700,
      temperature: 0.4,
      signal:      external,
    });

    if (result !== null) return result;
    // null 이면 추론 실패 → HTTP 폴백으로 낙하
    console.warn('[llmService] wllama 추론 실패, LM Studio 폴백');
  }

  // ── 2순위: LM Studio HTTP API ──────────────────────────────────────────
  const { signal, cancel } = withTimeout(external);
  try {
    const body: ChatMessage[] = [...messages];
    if (useJsonHint) {
      body.push({ role: 'user', content: 'Return only a valid JSON object. Do not include markdown.' });
    }

    const res = await fetch(LM_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model:       LM_MODEL,
        messages:    body,
        stream:      false,
        temperature: 0.4,
        max_tokens:  700,
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new Error(`LM Studio HTTP ${res.status}: ${bodyText.slice(0, 200)}`);
    }

    const data = (await res.json()) as LmStudioResponse;
    if (data.error) {
      const msg = typeof data.error === 'string' ? data.error : data.error.message;
      throw new Error(`LM Studio error: ${msg ?? 'unknown'}`);
    }

    const content = data.choices?.[0]?.message?.content ?? '';
    if (!content) throw new Error('LM Studio 빈 응답');
    return content;
  } finally {
    cancel();
  }
}

// ---------------------------------------------------------------------------
// 공개 서비스 API
// ---------------------------------------------------------------------------

export const llmService = {
  /** 현재 사용 중인 엔진 종류. */
  get mode(): 'wllama' | 'lmstudio' | 'idle' {
    const p = llmEngine.getStatus().phase;
    return p === 'ready' ? 'wllama' : p === 'loading' ? 'idle' : 'lmstudio';
  },

  /**
   * 학습자의 발화(transcript)가 기준 답변(expected) 중 하나와 맞는지 판정.
   *
   * - 정규화 후 완전 일치 → LLM 호출 없이 즉시 match.
   * - 그 밖 → LLM 에 JSON 판정 요청.
   * - 실패 시 안전한 기본값 반환.
   */
  async evaluate(
    expected: readonly string[],
    transcript: string,
    context: string,
    signal?: AbortSignal,
  ): Promise<EvalResult> {
    const norm = (s: string) => s.replace(/[\s.!?,。！？'"""''~…]/g, '').toLowerCase();
    const actual = norm(transcript);

    if (!actual) {
      return { verdict: 'close', feedback: '목소리가 작게 들렸어요. 다시 한번 말해봐요.' };
    }
    for (const ex of expected) {
      if (norm(ex) === actual) {
        return { verdict: 'match', feedback: '잘 하셨어요!' };
      }
    }

    const looksLikeQuestion =
      /\?|까요|나요|무엇|뭐|어떻게|어디|언제|누구|설명|알려/.test(transcript);

    const userPayload = JSON.stringify({
      expected: Array.from(expected),
      learner: transcript,
      context,
      hint_is_question: looksLikeQuestion,
    });

    try {
      const raw = await rawChat(
        [
          { role: 'system', content: EVAL_SYSTEM_PROMPT },
          { role: 'user',   content: userPayload },
        ],
        signal,
        true,
      );
      const parsed  = extractJson(raw) as Record<string, unknown>;
      const v       = typeof parsed.verdict === 'string' ? parsed.verdict : 'close';
      const verdict: EvalVerdict = VALID_VERDICTS.has(v as EvalVerdict)
        ? (v as EvalVerdict) : 'close';
      const feedback =
        typeof parsed.feedback === 'string' && parsed.feedback.trim()
          ? parsed.feedback.trim().slice(0, 120)
          : defaultFeedback(verdict);
      return { verdict, feedback };
    } catch (e) {
      console.warn('[llmService evaluate] 폴백:', e);
      return { verdict: looksLikeQuestion ? 'question' : 'close', feedback: defaultFeedback(looksLikeQuestion ? 'question' : 'close') };
    }
  },

  /**
   * 학습자의 질문에 대해 튜터 언어로 답변 생성.
   */
  async answer(context: string, question: string, signal?: AbortSignal): Promise<string> {
    const userPayload = `[지금 배우는 내용] ${context}\n[학습자 질문] ${question}`;
    try {
      const raw = await rawChat(
        [
          { role: 'system', content: ANSWER_SYSTEM_PROMPT },
          { role: 'user',   content: userPayload },
        ],
        signal,
        false,
      );
      return raw.trim().replace(/^["']+|["']+$/g, '').slice(0, 400) || DEFAULT_ANSWER;
    } catch (e) {
      console.warn('[llmService answer] 폴백:', e);
      return DEFAULT_ANSWER;
    }
  },

  /** 사용 가능한 백엔드 연결 확인. */
  async ping(): Promise<boolean> {
    // 내장 엔진이 준비됐으면 항상 true
    if (llmEngine.getStatus().phase === 'ready') return true;

    // LM Studio HTTP 확인
    try {
      const res = await fetch('/lmstudio/v1/models', { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  },
};

// ---------------------------------------------------------------------------
// 내부 유틸
// ---------------------------------------------------------------------------

const DEFAULT_ANSWER = '죄송해요, 잘 이해하지 못했어요. 선생님께 다시 여쭤봐요.';

function defaultFeedback(v: EvalVerdict): string {
  switch (v) {
    case 'match':     return '잘 하셨어요!';
    case 'close':     return '거의 맞아요. 한번 더 따라해볼까요?';
    case 'different': return '다시 한번 천천히 따라 말해봐요.';
    case 'question':  return '좋은 질문이에요! 조금 더 설명할게요.';
  }
}
