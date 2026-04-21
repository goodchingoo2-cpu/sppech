/**
 * wllama 기반 브라우저 내장 LLM 엔진 싱글턴.
 *
 * llama.cpp 를 WebAssembly 로 컴파일한 @wllama/wllama 라이브러리를 사용해
 * LM Studio 에 저장된 Gemma 4 E2B GGUF 파일을 브라우저에서 직접 실행한다.
 * 외부 서버(LM Studio)가 꺼져 있어도 동작한다.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * 모델 파일 경로
 *   Vite 개발 서버가 /local-model/* 요청을 가로채
 *   ~/.lmstudio/models/lmstudio-community/gemma-4-E2B-it-GGUF/
 *   gemma-4-E2B-it-Q4_K_M.gguf 를 스트리밍 서빙한다 (파일 복사 없음).
 *
 * WASM 파일 경로
 *   /wllama/single-thread/wllama.wasm
 *   /wllama/multi-thread/wllama.wasm  (멀티스레드 — SharedArrayBuffer 필요)
 *   → Vite 미들웨어가 node_modules/@wllama/wllama/esm/ 에서 서빙한다.
 *
 * 상태 흐름
 *   idle → loading(0~1 progress) → ready
 *                                ↘ error(message)
 *   unsupported  (WebAssembly 미지원 — 현실적으로 없음)
 * ──────────────────────────────────────────────────────────────────────────
 */

import { Wllama, type WllamaChatMessage } from '@wllama/wllama';
import { useSyncExternalStore } from 'react';

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export type EnginePhase = 'idle' | 'loading' | 'ready' | 'error' | 'unsupported';

export interface EngineStatus {
  readonly phase: EnginePhase;
  /** 0~1 (loading 단계에서만 의미 있음) */
  readonly progress: number;
  /** 현재 작업 설명 텍스트 */
  readonly progressText: string;
  /** 오류 메시지 (phase === 'error' 일 때) */
  readonly errorMsg: string;
  /** 모델 URL (로드 시 사용한 경로) */
  readonly modelUrl: string;
}

// ---------------------------------------------------------------------------
// 설정
// ---------------------------------------------------------------------------

/**
 * Vite 미들웨어가 서빙하는 GGUF URL.
 * Web Worker 안에서는 상대 경로가 파싱되지 않으므로 절대 URL 필수.
 * window.location.origin → e.g. http://127.0.0.1:5180
 */
const MODEL_URL = `${window.location.origin}/local-model/gemma-4-e2b.gguf`;

/** wllama WASM 파일도 절대 URL (Worker 내부 호환). */
const WASM_PATHS = {
  'single-thread/wllama.wasm': `${window.location.origin}/wllama/single-thread/wllama.wasm`,
  'multi-thread/wllama.wasm':  `${window.location.origin}/wllama/multi-thread/wllama.wasm`,
};

/** 추론 설정. */
const LOAD_CONFIG = {
  n_ctx:     2048,   // 컨텍스트 길이 (토큰)
  n_threads: Math.max(1, (navigator.hardwareConcurrency ?? 4) - 1), // CPU 스레드
};

// ---------------------------------------------------------------------------
// 싱글턴 상태
// ---------------------------------------------------------------------------

let _wllama: Wllama | null = null;
let _status: EngineStatus = {
  phase: 'idle',
  progress: 0,
  progressText: '',
  errorMsg: '',
  modelUrl: MODEL_URL,
};

const _listeners = new Set<() => void>();

function _emit(): void {
  _listeners.forEach((fn) => fn());
}

function _set(patch: Partial<EngineStatus>): void {
  _status = { ..._status, ...patch };
  _emit();
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

export const llmEngine = {

  /** 현재 상태 스냅샷 (React useSyncExternalStore 호환). */
  getStatus(): EngineStatus {
    return _status;
  },

  /** 준비된 Wllama 인스턴스. ready 상태일 때만 non-null. */
  getWllama(): Wllama | null {
    return _wllama;
  },

  /** 상태 변경 구독. 반환값은 해제 함수. */
  subscribe(fn: () => void): () => void {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  /**
   * 엔진 로드 시작.
   * - idle 또는 error 상태일 때만 동작.
   * - loading / ready / unsupported 상태면 무시.
   */
  async load(): Promise<void> {
    if (_status.phase === 'loading' || _status.phase === 'ready' || _status.phase === 'unsupported') {
      return;
    }

    // WebAssembly 지원 확인 (거의 모든 브라우저 지원)
    if (typeof WebAssembly === 'undefined') {
      _set({ phase: 'unsupported', errorMsg: '이 브라우저는 WebAssembly를 지원하지 않습니다.' });
      return;
    }

    _set({ phase: 'loading', progress: 0, progressText: 'wllama 초기화 중...', errorMsg: '' });

    try {
      const engine = new Wllama(WASM_PATHS, {
        logger: {
          debug: () => {},
          log:   () => {},
          warn:  (msg: string) => console.warn('[wllama]', msg),
          error: (msg: string) => console.error('[wllama]', msg),
        },
      });

      await engine.loadModelFromUrl(MODEL_URL, {
        ...LOAD_CONFIG,
        progressCallback: ({ loaded, total }) => {
          const pct = total > 0 ? loaded / total : 0;
          const loadedMB  = (loaded  / 1024 / 1024).toFixed(0);
          const totalMB   = (total   / 1024 / 1024).toFixed(0);
          _set({
            phase: 'loading',
            progress: pct,
            progressText: `모델 로드 중... ${loadedMB} / ${totalMB} MB`,
          });
        },
      });

      _wllama = engine;
      _set({ phase: 'ready', progress: 1, progressText: '준비 완료' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      _wllama = null;
      _set({ phase: 'error', errorMsg: msg });
      console.error('[llmEngine] 로드 실패:', err);
    }
  },

  /** 오류 상태에서 재시도. */
  retry(): void {
    _set({ phase: 'idle', progress: 0, progressText: '', errorMsg: '' });
    void llmEngine.load();
  },

  /** 엔진 메모리 해제. */
  async unload(): Promise<void> {
    if (_wllama) {
      try { await _wllama.exit(); } catch { /* ignore */ }
      _wllama = null;
    }
    _set({ phase: 'idle', progress: 0, progressText: '', errorMsg: '' });
  },

  /**
   * 채팅 추론 실행.
   * 엔진이 ready 상태여야 한다. 아니면 null 반환.
   */
  async chat(
    messages: WllamaChatMessage[],
    opts: { maxTokens?: number; temperature?: number; signal?: AbortSignal } = {},
  ): Promise<string | null> {
    if (!_wllama || _status.phase !== 'ready') return null;

    const { maxTokens = 512, temperature = 0.4, signal } = opts;
    try {
      const result = await _wllama.createChatCompletion(messages, {
        nPredict: maxTokens,
        sampling: { temp: temperature },
        useCache: true,
        abortSignal: signal,
      });
      return result;
    } catch (err) {
      console.warn('[llmEngine] 추론 실패:', err);
      return null;
    }
  },
};

// ---------------------------------------------------------------------------
// React 훅
// ---------------------------------------------------------------------------

/** 엔진 상태를 구독하는 React 훅. 상태 변경 시 리렌더. */
export function useEngineStatus(): EngineStatus {
  return useSyncExternalStore(
    llmEngine.subscribe,
    llmEngine.getStatus,
    llmEngine.getStatus,
  );
}

// 타입 재수출 (llmService.ts 에서 임포트 편의)
export type { WllamaChatMessage };
