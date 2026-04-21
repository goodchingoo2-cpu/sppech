/**
 * LLM 엔진 로딩 상태 표시 컴포넌트.
 *
 * - loading: 진행률 바 + 텍스트 (처음 실행 시 모델을 브라우저 캐시에 저장, 이후 빠름)
 * - error:   오류 메시지 + 재시도 버튼
 * - unsupported: 브라우저 미지원 안내
 * - ready / idle: 아무것도 표시하지 않음
 */

import { llmEngine, useEngineStatus } from './llmEngine.js';

export function LLMEngineStatus() {
  const status = useEngineStatus();

  if (status.phase === 'idle' || status.phase === 'ready') return null;

  if (status.phase === 'unsupported') {
    return (
      <div style={styles.banner}>
        <span style={styles.icon}>⚠️</span>
        <span style={styles.text}>
          {status.errorMsg || '이 브라우저는 내장 엔진을 지원하지 않습니다. LM Studio 폴백 모드로 동작합니다.'}
        </span>
      </div>
    );
  }

  if (status.phase === 'error') {
    return (
      <div style={{ ...styles.banner, ...styles.bannerError }}>
        <span style={styles.icon}>❌</span>
        <span style={styles.text}>
          <strong>엔진 로드 실패</strong> — LM Studio 폴백으로 동작합니다.
          <br />
          <small style={styles.detail}>{status.errorMsg}</small>
        </span>
        <button
          onClick={() => llmEngine.retry()}
          style={styles.retryBtn}
        >
          재시도
        </button>
      </div>
    );
  }

  // loading
  const pct = Math.round(status.progress * 100);
  return (
    <div style={styles.loadingWrap}>
      <div style={styles.loadingHeader}>
        <span style={styles.icon}>🧠</span>
        <span style={styles.loadingTitle}>
          Gemma 4 E2B 내장 엔진 초기화 중...
        </span>
        <span style={styles.loadingPct}>{pct}%</span>
      </div>

      <div style={styles.barTrack}>
        <div style={{ ...styles.barFill, width: `${pct}%` }} />
      </div>

      <div style={styles.loadingDetail}>{status.progressText}</div>

      {pct < 5 && (
        <div style={styles.hint}>
          💡 첫 실행 시 모델(~3.2 GB)을 브라우저 캐시에 저장합니다. 이후 실행은 빠릅니다.
          엔진 준비 전에도 LM Studio 폴백으로 수업을 시작할 수 있습니다.
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '8px 14px',
    background: 'rgba(234,179,8,0.08)',
    border: '1px solid rgba(234,179,8,0.3)',
    borderRadius: 6,
    fontSize: 12,
    color: '#fde68a',
  },
  bannerError: {
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#fca5a5',
  },
  icon: {
    flexShrink: 0,
    fontSize: 14,
    marginTop: 1,
  },
  text: {
    flex: 1,
    lineHeight: 1.5,
  },
  detail: {
    fontSize: 10,
    color: '#ef4444',
    wordBreak: 'break-all',
  },
  retryBtn: {
    flexShrink: 0,
    padding: '3px 10px',
    border: '1px solid #b91c1c',
    background: '#7f1d1d',
    color: '#fca5a5',
    borderRadius: 4,
    fontSize: 11,
    cursor: 'pointer',
  },
  loadingWrap: {
    padding: '10px 14px',
    background: 'rgba(99,102,241,0.07)',
    border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  loadingHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  loadingTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: 600,
    color: '#c7d2fe',
  },
  loadingPct: {
    fontSize: 12,
    fontWeight: 700,
    color: '#818cf8',
    minWidth: 36,
    textAlign: 'right',
  },
  barTrack: {
    height: 6,
    background: '#1e293b',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #6366f1, #818cf8)',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
  loadingDetail: {
    fontSize: 10,
    color: '#64748b',
  },
  hint: {
    fontSize: 10,
    color: '#475569',
    lineHeight: 1.5,
    borderTop: '1px solid rgba(99,102,241,0.15)',
    paddingTop: 6,
    marginTop: 2,
  },
};
