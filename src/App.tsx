/**
 * 한국어 스피치 애니메이션 - 최소 UI (Phase 3).
 * - 텍스트 입력 → 타임라인 생성 → 아바타 립싱크
 * - 속도 선택 (느리게/보통/빠르게)
 * - 표정 전환
 * - Web Speech API TTS 연동: 음성 시작 시 타임라인 재생을 동기화한다.
 */

import { useEffect, useRef, useState } from 'react';
import { AvatarStage } from './animation/Avatar.js';
import { avatarBus } from './animation/avatarBus.js';
import { generateTimeline } from './viseme/timeline.js';
import type { ExpressionName } from './animation/ExpressionPreset.js';
import { AvatarCustomizer } from './avatar/AvatarCustomizer.js';
import { useAvatarConfig } from './avatar/avatarConfig.js';
import { ttsService, pickVoiceByGender } from './tts/ttsService.js';
import { TutorSlide } from './tutor/TutorSlide.js';
import { TutorControls } from './tutor/TutorControls.js';
import { LLMEngineStatus } from './tutor/LLMEngineStatus.js';
import { useTutorSession, type TutorProgress } from './tutor/useTutorSession.js';
import type { TutorTurn } from './tutor/types.js';
import { CURRICULA } from './curriculum/book1.js';
import { llmEngine } from './tutor/llmEngine.js';

type Speed = 'slow' | 'normal' | 'fast';

const SPEED_FACTOR: Record<Speed, number> = {
  slow: 0.7,
  normal: 1.0,
  fast: 1.3,
};

export default function App() {
  const [text, setText] = useState('안녕하세요. 만나서 반가워요.');
  const [speed, setSpeed] = useState<Speed>('normal');
  const [expression, setExpression] = useState<ExpressionName>('smile');
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [tutorMode, setTutorMode] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>('');
  const [muted, setMuted] = useState(false);
  const cfg = useAvatarConfig();
  // 사용자가 드롭다운으로 직접 고른 경우엔 성별 변경 시 덮어쓰지 않는다.
  const userPickedRef = useRef(false);

  // 한국어 음성 목록을 로드. Chrome은 voiceschanged 이벤트 후에야 채워지므로 비동기.
  useEffect(() => {
    let cancelled = false;
    ttsService.loadKoreanVoices().then((list) => {
      if (cancelled) return;
      setVoices(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 성별(아바타 설정) 또는 음성 목록이 바뀌면 자동으로 매칭되는 음성을 고른다.
  // 단, 사용자가 드롭다운에서 수동 선택했다면 그 선택을 유지.
  useEffect(() => {
    if (voices.length === 0) return;
    if (userPickedRef.current) return;
    const pick = pickVoiceByGender(voices, cfg.gender);
    if (pick) setVoiceURI(pick.voiceURI);
  }, [voices, cfg.gender]);

  /** 주어진 문자열을 발화한다. 인자를 생략하면 현재 입력 텍스트를 사용. */
  function speak(spokenText: string = text): void {
    const rate = SPEED_FACTOR[speed];
    const frames = generateTimeline(spokenText, { speed: rate });

    // 음소거이거나 TTS 미지원 환경 → 애니메이션만 즉시 재생.
    if (muted || !ttsService.isSupported()) {
      avatarBus.play(frames);
      return;
    }

    // TTS 실제 발화 시작(onstart) 시점에 립싱크를 시작해 지연 차이를 최소화한다.
    const voice = voices.find((v) => v.voiceURI === voiceURI) ?? null;
    ttsService.speak({
      text: spokenText,
      rate,
      voice,
      onStart: () => avatarBus.play(frames),
      onEnd: () => avatarBus.stop(),
      onError: (err) => {
        console.warn('[TTS] error:', err);
        // TTS가 실패해도 애니메이션은 계속 볼 수 있도록 독립 재생.
        avatarBus.play(frames);
      },
    });
  }

  function onSpeak(): void {
    speak();
  }

  /** 튜터 세션 — 자율 LLM 진행 모드. */
  const selectedVoice = voices.find((v) => v.voiceURI === voiceURI) ?? null;
  const tutor = useTutorSession({
    rate: SPEED_FACTOR[speed],
    voice: selectedVoice,
    muted,
  });

  /** 튜터 모드 토글 — 실행 중이면 종료까지 한다. */
  function toggleTutorMode(): void {
    if (tutorMode) {
      tutor.stop();
      setTutorMode(false);
    } else {
      setShowCustomizer(false);
      setTutorMode(true);
      // 튜터 모드 진입 시 내장 LLM 엔진 로드 시작 (이미 로딩/준비 중이면 무시됨)
      void llmEngine.load();
    }
  }

  function onStop() {
    ttsService.stop();
    avatarBus.stop();
  }

  function onExpression(name: ExpressionName) {
    setExpression(name);
    avatarBus.setExpression(name);
  }

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <span>한국어 스피치 애니메이션</span>
        <div style={styles.headerBtns}>
          <button
            onClick={toggleTutorMode}
            style={{
              ...styles.headerBtn,
              ...(tutorMode ? styles.headerBtnActive : null),
            }}
            title="AI 튜터 수업"
          >
            {tutorMode ? '✕ 튜터 종료' : '🎓 튜터 수업'}
          </button>
          <button
            onClick={() => setShowCustomizer((v) => !v)}
            style={{
              ...styles.headerBtn,
              ...(showCustomizer ? styles.headerBtnActive : null),
            }}
            title="외모 커스터마이징"
          >
            {showCustomizer ? '✕ 닫기' : '👤 외모'}
          </button>
        </div>
      </header>

      {/* 메인 영역: 튜터 모드면 좌/우 2분할 (아바타 | 슬라이드), 아니면 단일 아바타. */}
      {tutorMode ? (
        <div style={styles.splitStage}>
          <div style={styles.splitLeft}>
            <AvatarStage />
          </div>
          <div style={styles.splitRight}>
            <TutorSlide
              slide={tutor.slide}
              state={tutor.state}
              interimTranscript={tutor.interim}
              progressLabel={buildProgressLabel(tutor.progress)}
              lastLearnerTurn={lastLearnerTurn(tutor.turns)}
            />
          </div>
        </div>
      ) : (
        <div style={styles.stage}>
          <AvatarStage />
        </div>
      )}

      {showCustomizer && (
        <div style={styles.customizerWrap}>
          <AvatarCustomizer />
        </div>
      )}

      {/* 튜터 모드 — 엔진 로딩/오류 상태 표시 */}
      {tutorMode && (
        <div style={styles.engineStatusWrap}>
          <LLMEngineStatus />
        </div>
      )}

      {/* 하단 컨트롤: 튜터 모드면 대화 UI, 아니면 기존 텍스트/속도/표정/음성. */}
      {tutorMode ? (
        <TutorControls
          state={tutor.state}
          turns={tutor.turns}
          error={tutor.error}
          isSttSupported={tutor.isSttSupported}
          curricula={CURRICULA}
          onStart={tutor.start}
          onStop={tutor.stop}
          onSkipListening={tutor.skipListening}
        />
      ) : (
      <div style={styles.panel}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={styles.textarea}
          rows={2}
          placeholder="한국어 문장을 입력하세요"
        />

        <div style={styles.row}>
          <label style={styles.label}>속도</label>
          <Segmented
            value={speed}
            options={[
              { v: 'slow', label: '느리게' },
              { v: 'normal', label: '보통' },
              { v: 'fast', label: '빠르게' },
            ]}
            onChange={setSpeed}
          />
        </div>

        <div style={styles.row}>
          <label style={styles.label}>표정</label>
          <Segmented
            value={expression}
            options={[
              { v: 'neutral', label: '중립' },
              { v: 'smile', label: '미소' },
              { v: 'encouraging', label: '격려' },
              { v: 'surprised', label: '놀람' },
              { v: 'thinking', label: '생각' },
            ]}
            onChange={onExpression}
          />
        </div>

        <div style={styles.row}>
          <label style={styles.label}>음성</label>
          {voices.length > 0 ? (
            <select
              value={voiceURI}
              onChange={(e) => {
                userPickedRef.current = true;
                setVoiceURI(e.target.value);
              }}
              style={styles.select}
              disabled={muted}
            >
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          ) : (
            <span style={styles.muted}>한국어 음성 없음 (애니메이션만 재생)</span>
          )}
          <label style={styles.muteLabel}>
            <input
              type="checkbox"
              checked={muted}
              onChange={(e) => setMuted(e.target.checked)}
            />
            <span>음소거</span>
          </label>
        </div>

        <div style={styles.buttons}>
          <button onClick={onSpeak} style={{ ...styles.btn, ...styles.btnPrimary }}>
            말하기
          </button>
          <button onClick={onStop} style={styles.btn}>
            정지
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

/** 슬라이드 좌상단에 "1단원 · 2/7" 형태 라벨 생성. 비어 있으면 undefined. */
function buildProgressLabel(p: TutorProgress): string | undefined {
  if (!p.unit || !p.lesson || p.totalSteps === 0) return undefined;
  const stepHuman = Math.min(p.stepIndex + 1, p.totalSteps);
  return `${p.unit.title} · ${stepHuman}/${p.totalSteps}`;
}

/** 최근 학습자 발화 반환 (슬라이드 하단 표시용). */
function lastLearnerTurn(turns: readonly TutorTurn[]): TutorTurn | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t && t.role === 'learner') return t;
  }
  return null;
}

function Segmented<T extends string>(props: {
  value: T;
  options: readonly { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={styles.segmented}>
      {props.options.map((o) => (
        <button
          key={o.v}
          onClick={() => props.onChange(o.v)}
          style={{
            ...styles.segItem,
            ...(o.v === props.value ? styles.segItemActive : null),
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#0f172a',
    color: '#e2e8f0',
    fontFamily: 'system-ui, -apple-system, "Noto Sans KR", sans-serif',
  },
  header: {
    padding: '10px 16px',
    fontSize: 18,
    fontWeight: 700,
    color: '#a5b4fc',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerBtns: {
    display: 'flex',
    gap: 6,
  },
  headerBtn: {
    padding: '6px 10px',
    border: '1px solid #334155',
    background: '#0b1220',
    color: '#cbd5e1',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 500,
  },
  headerBtnActive: {
    background: '#3b82f6',
    border: '1px solid #3b82f6',
    color: 'white',
  },
  customizerWrap: {
    padding: '8px 12px 0 12px',
    background: '#111827',
    maxHeight: '45vh',
    overflowY: 'auto',
  },
  stage: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  splitStage: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'row',
    borderTop: '1px solid #1e293b',
  },
  splitLeft: {
    flex: '1 1 45%',
    minWidth: 0,
    position: 'relative',
    borderRight: '1px solid #1e293b',
  },
  splitRight: {
    flex: '1 1 55%',
    minWidth: 0,
    position: 'relative',
  },
  engineStatusWrap: {
    padding: '0 12px 0 12px',
    background: '#111827',
  },
  panel: {
    padding: 16,
    background: '#111827',
    borderTop: '1px solid #1e293b',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  textarea: {
    width: '100%',
    padding: 10,
    borderRadius: 8,
    border: '1px solid #334155',
    background: '#0b1220',
    color: '#e2e8f0',
    fontSize: 15,
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  label: {
    minWidth: 42,
    fontSize: 13,
    color: '#94a3b8',
  },
  segmented: {
    display: 'flex',
    gap: 4,
    background: '#0b1220',
    padding: 3,
    borderRadius: 8,
    border: '1px solid #334155',
  },
  segItem: {
    padding: '6px 12px',
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
  },
  segItemActive: {
    background: '#3b82f6',
    color: 'white',
  },
  select: {
    flex: 1,
    minWidth: 0,
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid #334155',
    background: '#0b1220',
    color: '#e2e8f0',
    fontSize: 13,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  muted: {
    flex: 1,
    fontSize: 12,
    color: '#64748b',
  },
  muteLabel: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    fontSize: 12,
    color: '#cbd5e1',
    cursor: 'pointer',
  },
  buttons: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
    paddingTop: 4,
  },
  btn: {
    padding: '10px 24px',
    border: '1px solid #334155',
    background: '#1e293b',
    color: '#e2e8f0',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnPrimary: {
    background: '#3b82f6',
    border: '1px solid #3b82f6',
    color: 'white',
  },
};
