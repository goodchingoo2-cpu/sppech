/**
 * 아바타 외형 커스터마이징 설정 저장소.
 *
 * - `url`:        GLB 리소스 URL. 기본값은 `.env`의 VITE_MODEL_URL 또는 /models/tutor.glb.
 *                 Blob URL(업로드된 파일)도 이 자리에 들어올 수 있다.
 * - `hideExtras`: true면 'Wolf3D_Avatar_Transparent' 등 머리카락/액세서리 메시를 숨김
 *                 (visage 샘플의 헬멧을 가리기 위한 기본값). 사용자가 만든 RPM
 *                 아바타로 교체했을 때는 끄는 편이 낫다(머리카락 보이게).
 * - `showNeck`:  true면 클리핑 평면을 내려서 목·어깨까지 보이게 함. 기본 false는
 *                얼굴만 노출.
 *
 * localStorage로 영속화하되 blob: URL은 저장하지 않는다(세션 한정).
 *
 * 구독은 avatarBus와 동일한 단순 pub/sub 패턴. React 훅은 `useAvatarConfig`.
 */

import { useSyncExternalStore } from 'react';

export type AvatarGender = 'male' | 'female';

export interface AvatarConfig {
  readonly url: string;
  readonly hideExtras: boolean;
  readonly showNeck: boolean;
  /** 아바타 성별 — TTS 음성 자동 선택에 쓰인다. 기본 'male'(현재 샘플이 남성형). */
  readonly gender: AvatarGender;
}

const DEFAULT_URL =
  (import.meta.env?.VITE_MODEL_URL as string | undefined) ?? '/models/tutor.glb';

const STORAGE_KEY = 'avatar-config-v1';

const DEFAULTS: AvatarConfig = {
  url: DEFAULT_URL,
  hideExtras: true,
  showNeck: false,
  gender: 'male',
};

/** 저장된 URL이 다음 세션에서 유효한지 간이 검증.
 *  - blob:  이전 세션의 ObjectURL이라 무조건 무효 → DEFAULT_URL로 복구
 *  - data:  거대한 인라인 바이너리라 localStorage에 들어있으면 성능·무결성 위험 → 복구
 *  - 빈 문자열/비문자열 → 복구
 *  그 외(상대경로, http/https, file:)는 그대로 둔다.
 */
function sanitizeStoredUrl(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_URL;
  const u = raw.trim();
  if (!u) return DEFAULT_URL;
  if (u.startsWith('blob:')) return DEFAULT_URL;
  if (u.startsWith('data:')) return DEFAULT_URL;
  return u;
}

function loadInitial(): AvatarConfig {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AvatarConfig>;
    const gender: AvatarGender = parsed.gender === 'female' ? 'female' : 'male';
    return {
      url: sanitizeStoredUrl(parsed.url),
      hideExtras: parsed.hideExtras !== undefined ? !!parsed.hideExtras : true,
      showNeck: !!parsed.showNeck,
      gender,
    };
  } catch {
    return DEFAULTS;
  }
}

let state: AvatarConfig = loadInitial();
const listeners = new Set<() => void>();

function persist(next: AvatarConfig): void {
  if (typeof window === 'undefined') return;
  // blob: URL은 저장하지 않는다(다음 세션에 무효). 대신 DEFAULT_URL로 떨어지도록
  // 저장 시 url을 누락.
  const toSave = next.url.startsWith('blob:')
    ? { hideExtras: next.hideExtras, showNeck: next.showNeck }
    : next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    /* quota, private mode 등 무시 */
  }
}

function emit(): void {
  listeners.forEach((l) => l());
}

function setState(patch: Partial<AvatarConfig>): void {
  const next = { ...state, ...patch };
  if (
    next.url === state.url &&
    next.hideExtras === state.hideExtras &&
    next.showNeck === state.showNeck &&
    next.gender === state.gender
  ) {
    return;
  }
  // 이전 blob URL은 새 URL로 바뀌는 시점에 해제 (메모리 누수 방지)
  if (state.url.startsWith('blob:') && state.url !== next.url) {
    try {
      URL.revokeObjectURL(state.url);
    } catch {
      /* ignore */
    }
  }
  state = next;
  persist(next);
  emit();
}

export const avatarConfig = {
  get(): AvatarConfig {
    return state;
  },
  setUrl(url: string): void {
    setState({ url });
  },
  setHideExtras(v: boolean): void {
    setState({ hideExtras: v });
  },
  setShowNeck(v: boolean): void {
    setState({ showNeck: v });
  },
  setGender(g: AvatarGender): void {
    setState({ gender: g });
  },
  resetToDefault(): void {
    setState({ ...DEFAULTS });
  },
  getDefaultUrl(): string {
    return DEFAULT_URL;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

/** React 훅: 설정 상태를 구독하고 변경 시 리렌더. */
export function useAvatarConfig(): AvatarConfig {
  return useSyncExternalStore(avatarConfig.subscribe, avatarConfig.get, avatarConfig.get);
}
