/**
 * LM Studio 기반 LLM 서비스 (OpenAI 호환 엔드포인트 사용).
 *
 * 이전 버전: 로컬 스크립트 형태의 LLM에 직접 스크립트를 JSON으로 생성.
 *            gemma4:e4b(구형 모델)가 순수 JSON을 반환하지 못하는 문제로 교체.
 *
 * 현재 버전: 이 스크립트(curriculum/book1.ts)를 입력받아 LLM이 두 가지 역할을 맡는다.
 *   1) evaluate(): 학습자의 발화/답변이 정상 맞는지 LLM으로 판정
 *   2) answer():   학습자의 질문에 튜터 언어로 LLM으로 답변
 *
 * 답변 속도를 고려하고 비교적 가벼운 E2B 모델로도 충분하게 설계.
 * AbortController로 10초 타임아웃을 걸고, 실패 시 안전한 기본값으로 대체한다.
 *
 * 실행 조건:
 *  - LM Studio 실행: Developer 탭 → Local Server 켜기 (기본 포트 1234)
 *  - 모델: 기본 gemma4:e2b 또는 `.env.local`의 VITE_LM_STUDIO_MODEL로 지정
 *  - Vite dev 프록시가 `/lmstudio` → `http://localhost:1234` 포워딩(vite.config.ts)
 */

import { EVAL_SYSTEM_PROMPT, ANSWER_SYSTEM_PROMPT } from './systemPrompt.js';

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

const MODEL = (import.meta.env?.VITE_LM_STUDIO_MODEL as string | undefined) ?? 'gemma4:e2b';
const ENDPOINT = '/lmstudio/v1/chat/completions';
const TIMEOUT_MS = 10_000;

const VALID_VERDICTS: ReadonlySet<EvalVerdict> = new Set([
  'match',
  'close',
  'different',
  'question',
]);

interface LmStudioChatResponse {
  readonly choices?: ReadonlyArray<{
    readonly message?: { readonly role?: string; readonly content?: string };
  }>;
  readonly error?: string | { readonly message?: string };
}

/** 마크다운/코드블록 래퍼 제거 후 순수 JSON 객체 파싱. */
function extractJson(content: string): unknown {
  const trimmed = content.trim();
  const m = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = m ? m[1]!.trim() : trimmed;
  const first = body.indexOf('{');
  const last = body.lastIndexOf('}');
  const jsonStr = first >= 0 && last > first ? body.slice(first, last + 1) : body;
  return JSON.parse(jsonStr);
}

/** 외부 AbortSignal + 내부 타임아웃을 결합한 AbortController 생성. */
function withTimeout(external?: AbortSignal): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error('LLM timeout')), TIMEOUT_MS);
  const onExternalAbort = () => ctrl.abort(external?.reason);
  if (external) {
    if (external.aborted) ctrl.abort(external.reason);
    else external.addEventListener('abort', onExternalAbort, { once: true });
  }
  return {
    signal: ctrl.signal,
    cancel: () => {
      clearTimeout(t);
      external?.removeEventListener('abort', onExternalAbort);
    },
  };
}

/** LM Studio OpenAI-compatible /v1/chat/completions 저수준 호출. */
async function rawChat(
  messages: readonly ChatMessage[],
  external: AbortSignal | undefined,
  useJsonFormat: boolean,
): Promise<string> {
  const { signal, cancel } = withTimeout(external);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: MODEL,
        messages: useJsonFormat
          ? [
              ...messages,
              { role: 'user', content: 'Return only a valid JSON object. Do not include markdown.' } satisfies ChatMessage,
            ]
          : messages,
        stream: false,
        temperature: 0.4,
        max_tokens: 700,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`LM Studio HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as LmStudioChatResponse;
    if (data.error) {
      const message = typeof data.error === 'string' ? data.error : data.error.message;
      throw new Error(`LM Studio error: ${message || 'unknown error'}`);
    }
    const content = data.choices?.[0]?.message?.content ?? '';
    if (!content) throw new Error('LM Studio returned empty content');
    return content;
  } finally {
    cancel();
  }
}

export const llmService = {
  model: MODEL,

  /**
   * 학습자의 발화(transcript)가 기준 답변(expected) 중 하나와 맞는지 판정.
   *
   * - expected의 각 항목에서 공백/구두점을 제거한 뒤 정규화해 비교.
   * - 빠른 경로: 정규화된 글자가 일치하면 LLM 호출 없이 즉시 match 반환.
   * - 그 밖에는 LLM에 JSON 판정을 요청.
   * - LLM 실패/타임아웃 시 안전한 기본값(질문이면 question, 아니면 close).
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

    // 질문처럼 들리는 패턴
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
          { role: 'user', content: userPayload },
        ],
        signal,
        true,
      );
      const parsed = extractJson(raw) as Record<string, unknown>;
      const v = typeof parsed.verdict === 'string' ? parsed.verdict : 'close';
      const verdict: EvalVerdict = VALID_VERDICTS.has(v as EvalVerdict)
        ? (v as EvalVerdict)
        : 'close';
      const feedback =
        typeof parsed.feedback === 'string' && parsed.feedback.trim()
          ? parsed.feedback.trim().slice(0, 120)
          : defaultFeedback(verdict);
      return { verdict, feedback };
    } catch (e) {
      console.warn('[LLM evaluate] fallback:', e);
      const verdict: EvalVerdict = looksLikeQuestion ? 'question' : 'close';
      return { verdict, feedback: defaultFeedback(verdict) };
    }
  },

  /**
   * 학습자의 질문에 대해 튜터 언어로 답변을 생성.
   * context: 지금 배우고 있는 레슨/단계의 내용을 알려준다.
   */
  async answer(context: string, question: string, signal?: AbortSignal): Promise<string> {
    const userPayload = `[지금 배우는 내용] ${context}\n[학습자 질문] ${question}`;
    try {
      const raw = await rawChat(
        [
          { role: 'system', content: ANSWER_SYSTEM_PROMPT },
          { role: 'user', content: userPayload },
        ],
        signal,
        false,
      );
      return raw.trim().replace(/^["']+|["']+$/g, '').slice(0, 400) || DEFAULT_ANSWER;
    } catch (e) {
      console.warn('[LLM answer] fallback:', e);
      return DEFAULT_ANSWER;
    }
  },

  /** LM Studio 서버 연결 확인 (ping). */
  async ping(): Promise<boolean> {
    try {
      const res = await fetch('/lmstudio/v1/models', { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  },
};

const DEFAULT_ANSWER =
  '죄송해요, 잘 이해하지 못했어요. 선생님께 다시 여쭤봐요.';

function defaultFeedback(v: EvalVerdict): string {
  switch (v) {
    case 'match':
      return '잘 하셨어요!';
    case 'close':
      return '거의 맞아요. 한번 더 따라해볼까요?';
    case 'different':
      return '다시 한번 천천히 따라 말해봐요.';
    case 'question':
      return '좋은 질문이에요! 조금 더 설명할게요.';
  }
}
