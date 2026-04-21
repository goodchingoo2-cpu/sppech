/**
 * 튜터 모드 우측 슬라이드 패널.
 *
 * 커리큘럼의 SlideMaterial을 받아 구성 요소별로 렌더링:
 *  - badge: 좌상단 진도 (X단원 Y/Z) / 우상단 상태 (듣는 중 등)
 *  - title: 상단 대제목
 *  - focus (+focusHint): 중앙 큰 글자 + 작은 힌트 ([a])
 *  - english: focus 아래 짧은 영어 설명
 *  - bullets: 항목 리스트 (예문/단어/영어 뜻)
 *  - examples: ko/en 쌍 리스트
 *  - interim: 듣는 중 실시간 자막
 */

import type { TutorState, TutorTurn } from './types.js';
import type { SlideMaterial } from '../curriculum/types.js';

interface Props {
  readonly slide: SlideMaterial | null;
  readonly state: TutorState;
  readonly interimTranscript?: string;
  readonly progressLabel?: string;
  readonly lastLearnerTurn?: TutorTurn | null;
}

const STATE_LABEL: Record<TutorState, { text: string; color: string }> = {
  idle: { text: '대기', color: '#64748b' },
  thinking: { text: '생각 중…', color: '#a78bfa' },
  speaking: { text: '말하는 중', color: '#3b82f6' },
  listening: { text: '듣는 중 🎤', color: '#10b981' },
  ended: { text: '수업 종료', color: '#94a3b8' },
};

export function TutorSlide({
  slide,
  state,
  interimTranscript,
  progressLabel,
  lastLearnerTurn,
}: Props) {
  const badge = STATE_LABEL[state];

  return (
    <div style={styles.root}>
      {progressLabel && <div style={styles.progress}>{progressLabel}</div>}
      <div style={{ ...styles.badge, background: badge.color }}>{badge.text}</div>

      {slide ? (
        <div style={styles.content}>
          {slide.title && <div style={styles.title}>{slide.title}</div>}

          {slide.focus && (
            <div style={styles.focusBox}>
              <div style={styles.focusLabel}>
                {state === 'listening' ? '따라해 보세요' : '오늘의 글자'}
              </div>
              <div style={styles.focus}>{slide.focus}</div>
              {slide.focusHint && <div style={styles.focusHint}>{slide.focusHint}</div>}
              {slide.english && <div style={styles.english}>{slide.english}</div>}
            </div>
          )}

          {!slide.focus && slide.english && (
            <div style={styles.englishStandalone}>{slide.english}</div>
          )}

          {slide.bullets && slide.bullets.length > 0 && (
            <ul style={styles.bullets}>
              {slide.bullets.map((b, i) => (
                <li key={i} style={styles.bullet}>
                  {b}
                </li>
              ))}
            </ul>
          )}

          {slide.examples && slide.examples.length > 0 && (
            <div style={styles.examples}>
              <div style={styles.examplesLabel}>예문</div>
              {slide.examples.map((ex, i) => (
                <div key={i} style={styles.exampleRow}>
                  <div style={styles.exampleKo}>{ex.ko}</div>
                  {ex.en && <div style={styles.exampleEn}>{ex.en}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>🎓</div>
          <div style={styles.emptyText}>
            아래에서 단원을 고르고 <b>수업 시작</b> 버튼을 누르세요.
            <br />
            튜터가 한국어를 단계별로 가르쳐 드려요.
          </div>
        </div>
      )}

      {state === 'listening' && interimTranscript && (
        <div style={styles.interim}>
          <span style={styles.interimLabel}>듣는 중…</span>
          <span style={styles.interimText}>"{interimTranscript}"</span>
        </div>
      )}

      {state !== 'listening' && lastLearnerTurn && (
        <div style={styles.lastLearner}>
          <span style={styles.lastLearnerLabel}>학생</span>
          <span style={styles.lastLearnerText}>"{lastLearnerTurn.text}"</span>
          {typeof lastLearnerTurn.confidence === 'number' && (
            <span style={styles.lastLearnerConf}>
              {Math.round(lastLearnerTurn.confidence * 100)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: 'linear-gradient(180deg, #0f172a 0%, #0b1220 100%)',
    color: '#e2e8f0',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    overflow: 'auto',
    boxSizing: 'border-box',
  },
  progress: {
    position: 'absolute',
    top: 12,
    left: 12,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 600,
    color: '#cbd5e1',
    background: 'rgba(15, 23, 42, 0.9)',
    border: '1px solid #334155',
    borderRadius: 999,
    letterSpacing: 0.3,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 600,
    color: 'white',
    borderRadius: 999,
    letterSpacing: 0.3,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    marginTop: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#f8fafc',
    borderBottom: '1px solid #1e293b',
    paddingBottom: 10,
    marginTop: 8,
  },
  focusBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '20px 12px',
    background: 'rgba(59, 130, 246, 0.08)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: 12,
  },
  focusLabel: {
    fontSize: 12,
    color: '#93c5fd',
    letterSpacing: 1,
    fontWeight: 600,
  },
  focus: {
    fontSize: 96,
    fontWeight: 700,
    color: '#f8fafc',
    lineHeight: 1,
    fontFamily: '"Noto Sans KR", system-ui, sans-serif',
    textAlign: 'center',
  },
  focusHint: {
    fontSize: 20,
    color: '#93c5fd',
    fontFamily: '"Courier New", monospace',
    letterSpacing: 1,
  },
  english: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 4,
    textAlign: 'center',
  },
  englishStandalone: {
    fontSize: 14,
    color: '#94a3b8',
    fontStyle: 'italic',
    padding: '6px 0',
  },
  bullets: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  bullet: {
    padding: '10px 14px',
    background: '#111827',
    border: '1px solid #1e293b',
    borderRadius: 8,
    fontSize: 16,
    color: '#e2e8f0',
    lineHeight: 1.4,
  },
  examples: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 12,
    background: 'rgba(30, 41, 59, 0.5)',
    border: '1px solid #1e293b',
    borderRadius: 10,
  },
  examplesLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: 700,
    letterSpacing: 1,
    marginBottom: 4,
  },
  exampleRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '6px 8px',
    borderLeft: '2px solid #3b82f6',
  },
  exampleKo: {
    fontSize: 15,
    color: '#f1f5f9',
    fontWeight: 500,
  },
  exampleEn: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 64,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 1.6,
  },
  interim: {
    marginTop: 'auto',
    padding: '10px 12px',
    background: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: 8,
    fontSize: 14,
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  interimLabel: {
    fontSize: 11,
    color: '#6ee7b7',
    fontWeight: 600,
    flexShrink: 0,
  },
  interimText: {
    color: '#cbd5e1',
    fontStyle: 'italic',
  },
  lastLearner: {
    marginTop: 'auto',
    padding: '8px 12px',
    background: 'rgba(167, 139, 250, 0.08)',
    border: '1px solid rgba(167, 139, 250, 0.25)',
    borderRadius: 8,
    fontSize: 13,
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  lastLearnerLabel: {
    fontSize: 11,
    color: '#c4b5fd',
    fontWeight: 700,
    flexShrink: 0,
  },
  lastLearnerText: {
    flex: 1,
    color: '#cbd5e1',
  },
  lastLearnerConf: {
    fontSize: 10,
    color: '#64748b',
    flexShrink: 0,
  },
};
