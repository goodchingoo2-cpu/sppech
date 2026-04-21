/**
 * Ollama 湲곕컲 LLM ?쒕퉬??(?ㅽ겕由쏀듃 湲곕컲 而ㅻ━?섎읆 ?꾩슜).
 *
 * ?댁쟾 踰꾩쟾: ?먯쑉 ?쒗꽣 ??LLM???꾩껜 ?섏뾽 ?ㅽ겕由쏀듃瑜?JSON?쇰줈 ?앹꽦.
 *            gemma4:e4b(?묒? 紐⑤뜽)媛 湲?JSON??留뚮뱾??吏???ㅽ뙣?섎뒗 臾몄젣濡??먭린.
 *
 * ?꾩옱 踰꾩쟾: ?깆씠 ?ㅽ겕由쏀듃(curriculum/book1.ts)瑜??뚮━怨?LLM? ??媛吏留??쒕떎.
 *   1) evaluate(): ?숈뒿??諛쒖쓬/?묐떟???덉긽 ?듬?怨?留욌뒗吏 吏㏐쾶 ?먯젙
 *   2) answer():   ?숈뒿?먯쓽 ?먯쑀 吏덈Ц??援ъ뼱泥??쒓뎅?대줈 吏㏐쾶 ?듬?
 *
 * ?????낅젰??吏㏐퀬 異쒕젰??吏㏃븘 E4B 紐⑤뜽濡쒕룄 異⑸텇??鍮좊Ⅴ??
 * AbortController濡?10珥???꾩븘?껋쓣 嫄멸퀬, ?ㅽ뙣 ???덉쟾??湲곕낯媛믪쑝濡??대갚?쒕떎.
 *
 * 援ъ꽦 ?붽굔:
 *  - Ollama 濡쒖뺄 ?ㅽ뻾: `ollama serve`
 *  - 紐⑤뜽: 湲곕낯 gemma4:e4b ??`.env.local`??VITE_OLLAMA_MODEL濡???뼱?곌린 媛?? *  - Vite dev ?쒕쾭媛 `/ollama` ??`http://localhost:11434` ?꾨줉??(vite.config.ts)
 */

import { EVAL_SYSTEM_PROMPT, ANSWER_SYSTEM_PROMPT } from './systemPrompt.js';

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/** ?숈뒿???묐떟 ?먯젙 寃곌낵. */
export type EvalVerdict = 'match' | 'close' | 'different' | 'question';
export interface EvalResult {
  readonly verdict: EvalVerdict;
  /** ?쒗꽣媛 ?숈뒿?먯뿉寃?留먰빐以??쒕몢 臾몄옣 ?쇰뱶諛? */
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

/** 肄붾뱶釉붾줉/?≪쓬 ?쒓굅 ??泥?JSON 媛앹껜 ?뚯떛. */
function extractJson(content: string): unknown {
  const trimmed = content.trim();
  const m = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = m ? m[1]!.trim() : trimmed;
  const first = body.indexOf('{');
  const last = body.lastIndexOf('}');
  const jsonStr = first >= 0 && last > first ? body.slice(first, last + 1) : body;
  return JSON.parse(jsonStr);
}

/** ?몃? AbortSignal + ?대? ??꾩븘?껋쓣 寃고빀??AbortController ?앹꽦. */
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
   * ?숈뒿?먯쓽 諛쒗솕(transcript)媛 湲곕? ?듬?(expected) 以??섎굹? 留욌뒗吏 ?먯젙.
   *
   * - expected??洹???ぉ?먯꽌 ?뺣떟?쇰줈 ?몄젙??蹂?뺣뱾(?? ['??, '??, 'a']).
   * - 鍮좊Ⅸ 留ㅼ묶: ?뺢퇋?붾맂 臾몄옄?댁씠 ?섎굹?쇰룄 媛숈쑝硫?利됱떆 match 諛섑솚 (LLM ?몄텧 X).
   * - 洹??몄뿉??LLM??吏㏃? JSON ?먯젙???붿껌.
   * - LLM ?ㅽ뙣/??꾩븘???? ?덉쟾???대갚(吏덈Ц泥섎읆 蹂댁씠硫?question, ?꾨땲硫?close).
   */
  async evaluate(
    expected: readonly string[],
    transcript: string,
    context: string,
    signal?: AbortSignal,
  ): Promise<EvalResult> {
    const norm = (s: string) => s.replace(/[\s.!?,。！？'"“”‘’~…]/g, '').toLowerCase();
    const actual = norm(transcript);
    if (!actual) {
      return { verdict: 'close', feedback: '?????ㅻ졇?댁슂. ?ㅼ떆 ??踰?留먰빐二쇱꽭??' };
    }
    for (const ex of expected) {
      if (norm(ex) === actual) {
        return { verdict: 'match', feedback: '?섑븯?⑥뼱??' };
      }
    }

    // 吏덈Ц?쇰줈 ?섏떖?섎뒗 ?⑦꽩
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
   * ?숈뒿?먯쓽 ?먯쑀 吏덈Ц??吏㏃? 援ъ뼱泥??쒓뎅???듬? ?앹꽦.
   * context: 吏湲??대뼡 ?⑥썝/??ぉ??諛곗슦??以묒씤吏 ??以??ㅻ챸.
   */
  async answer(context: string, question: string, signal?: AbortSignal): Promise<string> {
    const userPayload = `[吏湲?諛곗슦??以? ${context}\n[?숈깮 吏덈Ц] ${question}`;
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

  /** Ollama ?ъ뒪泥댄겕. */
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
  '醫뗭? 吏덈Ц?댁뿉?? 吏湲덉? ?먯꽭???ㅻ챸?섍린 ?대젮?뚯꽌, ?쇰떒 ?ㅼ쓬?쇰줈 ?섏뼱媛덇쾶??';

function defaultFeedback(v: EvalVerdict): string {
  switch (v) {
    case 'match':
      return '?섑븯?⑥뼱??';
    case 'close':
      return '鍮꾩듂?댁슂. ??踰덈쭔 ???대낵源뚯슂?';
    case 'different':
      return '?ㅼ떆 ??踰???諛쒖쓬?????ㅼ뼱蹂댁꽭??';
    case 'question':
      return '醫뗭? 吏덈Ц?대꽕?? ?좉퉸 ?ㅻ챸???쒕┫寃뚯슂.';
  }
}



