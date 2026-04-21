# CHANGES — 2D SVG 파이프라인에서 3D 아바타 튜터 시스템으로 전면 재설계

> **기준 커밋**: `b32e406 Activate path morphing: wire morphTarget/morphT through types, useSpeechAnimation, AnimationCanvas`
> **이번 커밋 범위**: 2026-04-16 ~ 2026-04-21

한국어 스피치 애니메이션 시스템이 **2D SVG 립모양 애니메이션 + Remotion 렌더링 파이프라인**에서
**실시간 3D 아바타 + AI 튜터 대화 시스템**으로 전면 재설계됐습니다. 본 문서는 그 변경 전체를
한 자리에서 추적하기 위한 요약입니다.

---

## 한눈에 보기

| 영역 | 이전 (b32e406 이하) | 현재 |
|---|---|---|
| 아바타 | 2D SVG 얼굴 (`LipShape.tsx`, `FaceAnimation.tsx`) | 3D GLB 스킨드 메시 (React Three Fiber + drei) |
| 립싱크 | SVG path morphing, 커스텀 타임라인 | ARKit 52 + Oculus Visemes morph target |
| LLM 두뇌 | Ollama `gemma3:e4b` | **LM Studio `gemma4:e2b`** (OpenAI 호환) |
| UI 구조 | `src/ui/*` 단일 앱 + 동영상 렌더 | `src/App.tsx` + 모듈형 `animation/avatar/tutor/...` |
| 수업 기능 | 없음 (문장 발화 데모만) | **AI 튜터 모드** — 맞춤한국어 1권 기반 대화 수업 |
| 음성 입력 | 없음 | Web Speech STT (학습자 발화 인식) |
| 음성 출력 | Remotion + 오프라인 MP3 | Web Speech TTS, 성별 기반 음성 자동 선택 |
| 렌더 타겟 | Remotion `bundle/render` (MP4 산출) | 실시간 브라우저 (Vite dev, 프로덕션 정적) |
| 엔트리 | `src/ui/index.html`, `cli.ts`, `server/api.ts` | `index.html` + `src/main.tsx` + `App.tsx` |

---

## 새 기능

### 1. 3D 아바타 시스템 (`src/animation/`, `src/avatar/`)

- **`Avatar.tsx`** — `@react-three/fiber` `<Canvas>` 안에 GLB 모델을 `useGLTF`로 로드. `SkeletonUtils.clone`으로 복제해 동시 사용 가능.
- **ARKit + Oculus Visemes 블렌드셰이프** 자동 감지 및 립싱크 매핑.
- **ModelErrorBoundary** — GLB 로드 실패 시 조용히 죽지 않고 상위에 콜백.
- **LoadErrorOverlay** — 실패 URL, 원인 힌트, **"기본 아바타로 리셋"** 버튼을 표시.
- **avatarBus** — 단순 pub/sub 이벤트 버스. `play(frames)`, `stop()`, `setExpression(name)` API.
- **ExpressionPreset** — 중립 / 미소 / 격려 / 놀람 / 생각 5종 표정 프리셋.

### 2. 아바타 외형 커스터마이징 (`src/avatar/avatarConfig.ts`, `AvatarCustomizer.tsx`)

- **Ready Player Me URL 적용**: RPM 페이지에서 만든 GLB URL을 붙여넣으면 `morphTargets=ARKit,Oculus Visemes` 쿼리를 자동 보강.
- **로컬 GLB 업로드**: `.glb` / `.gltf` 파일 드롭 시 `URL.createObjectURL`로 즉시 적용.
- **성별 선택** (`male` / `female`) — TTS 음성 자동 매칭용.
- **머리카락·액세서리 메시 숨김 토글** — `Wolf3D_Avatar_Transparent` 제어.
- **목·어깨까지 보이기 토글** — 클리핑 평면 제어.
- **localStorage 영속화** + `sanitizeStoredUrl()` — 다음 세션에 무효한 `blob:` / `data:` URL을 `DEFAULT_URL`로 강제 복구해 "갑자기 아바타가 사라지는" 버그 차단.
- `useSyncExternalStore` 기반 React 훅 `useAvatarConfig()`.

### 3. AI 튜터 모드 (`src/tutor/`)

맞춤한국어 1권 기반 자율 수업 시스템.

- **`useTutorSession.ts`** — 수업 세션 상태 머신 훅. `idle → teaching → listening → grading → ended` 전이.
- **`TutorControls.tsx`** — 하단 컨트롤 패널.
  - 대기 상태: 교재/단원/레슨 3단 드롭다운 피커 + 수업 시작 버튼. 준비 안 된 단원(`status: stub`)은 자동 필터링 + "{n}개 단원 준비 중" 안내.
  - 진행 중: 튜터/학습자 대화 로그 (최근 8턴) + ⏭건너뛰기 / ✕종료 버튼.
  - 에러 배너: LM Studio 연결 실패 시 `gemma4:e2b` 모델 확인 안내.
  - STT 미지원 브라우저에서는 자동 진행 모드로 폴백 경고.
- **`TutorSlide.tsx`** — 상단 슬라이드 영역. 현재 스텝의 한국어·영어·한자 병기, 학습자 인식 중인 interim 텍스트, 진도(`2/7`) 라벨, 직전 학습자 발화 표시.
- **`llmService.ts`** — LM Studio OpenAI 호환 엔드포인트 호출.
  - `POST /lmstudio/v1/chat/completions` (Vite 프록시를 통해 `127.0.0.1:1234`로 위임).
  - `useJsonFormat=true`일 때 "Return only a valid JSON object" 시스템 힌트 주입.
  - `AbortController` + 타임아웃.
  - 모델 확인용 `ping()` → `/lmstudio/v1/models`.

### 4. 커리큘럼 (`src/curriculum/`, `src/lessons/`)

- **`book1.ts`** — 맞춤한국어 1권을 구조화된 데이터로 정의.
  - `Curriculum → Unit → Lesson → Step` 4단 계층.
  - `Step.kind`: `intro` / `teach` / `repeat` / `check` / `outro` — 수업 흐름의 원시 상태.
  - `Unit.status`: `ready` / `stub` — 미완성 단원은 UI에서 비활성.
- 각 레슨은 한국어 문장·영어 번역·한자 주석·스크립트 힌트를 포함.

### 5. 한국어 TTS/STT (`src/tts/`, `src/stt/`)

- **`ttsService.ts`** — Web Speech API 래퍼.
  - `loadKoreanVoices()` — Chrome의 비동기 voice 로딩 대응 (`voiceschanged`).
  - `pickVoiceByGender(voices, gender)` — 음성 이름/메타에서 성별 추정해 매칭.
  - `speak({ text, rate, voice, onStart, onEnd, onError })` — `onstart` 시점에 립싱크를 동기 시작해 지연 최소화.
- **`sttService.ts`** — `webkitSpeechRecognition` 래퍼.
  - `lang='ko-KR'`, `interimResults=true`, 무음 타임아웃 보호.
  - Chrome/Edge만 지원 — 미지원 환경에서는 튜터가 응답 대기를 건너뛰고 진행.

### 6. 한국어 음소/비셈 분석 (`src/korean/`, `src/viseme/`)

- **한글 자모 분해** (초성·중성·종성 분리).
- **음소 → Viseme 매핑** — 한국어 자·모음을 ARKit 52 / Oculus Visemes 블렌드셰이프로 변환.
- **`timeline.ts` `generateTimeline(text, { speed })`** — 속도(0.7 / 1.0 / 1.3)를 반영해 립싱크 프레임 타임라인 생성.

---

## 백엔드 마이그레이션: Ollama → LM Studio

**이전**: 로컬 Ollama 서버 (`ollama run gemma3:e4b`), 자체 API 래퍼.

**현재**: LM Studio 로컬 서버 (OpenAI 호환).

| 항목 | 값 |
|---|---|
| 엔드포인트 | `http://localhost:1234/v1/chat/completions` |
| 모델 | `gemma4:e2b` (LM Studio에서 로드) |
| Vite 프록시 | `/lmstudio/*` → `http://127.0.0.1:1234/*` (prefix 제거 rewrite) |
| 환경변수 | `.env.local`의 `VITE_LM_STUDIO_URL`, `VITE_LM_STUDIO_MODEL` |
| 요청 형식 | OpenAI chat completions: `{ model, messages, temperature, response_format? }` |
| 응답 파싱 | `data.choices?.[0]?.message?.content` |

변경 이유:
- LM Studio UI로 모델 교체/로드가 더 쉬움
- OpenAI 호환 포맷이라 `openai` SDK 호환성 잠재 확보
- `e2b`가 `e4b` 대비 경량 (응답 지연 체감 개선)

---

## 설정 / 빌드

- **Vite 포트 5180** (`vite.config.ts`) — 다른 로컬 프로젝트(예: kdrama 5173)와 충돌 회피.
- **`publicDir: 'assets'`** — `/models/tutor.glb` 등 GLB가 Vite dev에서 즉시 서빙됨.
- **TypeScript strict** + `tsc --noEmit`을 `npm run build` 전에 돌림.
- **Vitest** — 단위 테스트 (한글 분해·타임라인 생성 검증 위주).
- **청크 경고**: 현재 번들 ~1.2MB (three.js + drei 포함). 추후 `manualChunks`로 분할 예정.

### 새로 추가된 npm 의존성

```json
"@react-three/drei": "^9.114.0",
"@react-three/fiber": "^8.17.10",
"three": "^0.169.0",
"@types/three": "^0.169.0"
```

### 제거된 의존성 / 파일 (이전 파이프라인)

- `src/cli.ts`, `src/server/`, `src/pipeline.ts`
- `remotion.config.ts`, Remotion 관련 의존성
- `src/ui/` (구 단일 앱) — `App.tsx` + `animation/avatar/tutor` 모듈로 대체
- `dotenv` 등 서버 전용 패키지

---

## 버그 수정 (최근)

### 3D 아바타가 "사라진" 것처럼 보이는 문제

**증상**: 이전 세션에서 RPM URL을 적용했다가 브라우저를 완전히 재시작하면 아바타 대신 placeholder 구체 3개가 떠 있었음.

**원인**: localStorage에 `blob:` URL이 저장돼 있다가 새 세션에서 무효가 돼 GLB 로딩이 실패, `Suspense` 내부에서 조용히 fallback으로 넘어감.

**수정**:
1. `avatarConfig.ts` — `sanitizeStoredUrl()`이 `blob:` / `data:` / 빈 문자열 / 비문자열을 감지해 `DEFAULT_URL`로 복구.
2. `Avatar.tsx` — `ModelErrorBoundary.onErrorChange` 콜백 추가. `AvatarStage`가 실패 상태를 `useState`로 잡아 `LoadErrorOverlay`(실패 URL 표시 + 기본값 리셋 버튼)를 렌더.

### `TutorControls.tsx` 한글 문자열 깨짐

**증상**: 린터가 UTF-8 파일을 CP949로 읽고 UTF-8로 다시 저장해 한글 주석·UI 문자열(`"교재"`, `"수업 시작"` 등)이 모지바케(예: `?쒗꽣 紐⑤뱶`)로 변함.

**수정**: 파일 전체를 깨끗한 UTF-8 한글로 재작성 (기능은 그대로 보존).

---

## 이번 커밋에서 하는 것

이전 Desktop 저장소(2D SVG 파이프라인, 커밋 `b32e406`까지)를 **전면 교체**합니다. 옛 2D 코드는 git 히스토리로만 남습니다 — 필요하면 `git checkout b32e406 -- <path>`로 복원 가능.

- OneDrive 작업 사본 → Desktop으로 이관 (OneDrive 용량 확보 목적).
- `.git` 디렉토리는 그대로 보존 → 기존 원격 `origin` (`goodchingoo2-cpu/sppech`) 그대로 푸시.
- `node_modules/`, `dist/`는 복사에서 제외 — `.gitignore`로도 관리됨. 수신 측은 `npm install` 필요.

---

## 로컬 실행

```bash
cd "C:\Users\babym\Desktop\한국어기반스피치애니메이션시스템\korean-speech-animation"
npm install
# LM Studio를 띄우고 gemma4:e2b 모델을 로드한 뒤
npm run dev        # http://localhost:5180
```

`npm run build`로 타입체크 + 프로덕션 빌드, `npm test`로 Vitest 단위 테스트.
