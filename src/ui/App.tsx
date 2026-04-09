// ============================================================
// 메인 UI — 텍스트 입력 → TTS + 입모양 애니메이션
// ============================================================

import React, { useState } from 'react';
import { AnimationCanvas } from './AnimationCanvas.js';
import { useSpeechAnimation } from './useSpeechAnimation.js';

type Rate = 'slow' | 'normal' | 'fast';

const RATE_LABELS: Record<Rate, string> = {
  slow: '느리게',
  normal: '보통',
  fast: '빠르게',
};

export function App() {
  const [text, setText] = useState('');
  const [rate, setRate] = useState<Rate>('normal');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const { status, currentFrame, error, speak, stop } = useSpeechAnimation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      await speak(text.trim(), rate);
    }
  };

  const handleExport = async () => {
    if (!text.trim()) return;
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), rate }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? '렌더링 실패');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = text.trim().slice(0, 20) + '.mp4';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const isBusy = status === 'loading' || status === 'speaking';

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>한국어 스피치 애니메이션</h1>

      {/* 애니메이션 영역 */}
      <div style={styles.canvasWrap}>
        <AnimationCanvas frame={currentFrame} size={360} />
        <div style={styles.statusBadge}>
          {status === 'idle' && '대기 중'}
          {status === 'loading' && '분석 중...'}
          {status === 'speaking' && '발화 중'}
          {status === 'done' && '완료'}
          {status === 'error' && '오류'}
        </div>
      </div>

      {/* 오류 메시지 */}
      {(error || exportError) && (
        <p style={styles.error}>{error || exportError}</p>
      )}

      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} style={styles.form}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="한국어 텍스트를 입력하세요..."
          style={styles.textarea}
          rows={3}
          disabled={isBusy}
        />

        {/* 발화 속도 */}
        <div style={styles.rateRow}>
          {(Object.keys(RATE_LABELS) as Rate[]).map(r => (
            <label key={r} style={styles.rateLabel}>
              <input
                type="radio"
                name="rate"
                value={r}
                checked={rate === r}
                onChange={() => setRate(r)}
                disabled={isBusy}
              />
              {' '}{RATE_LABELS[r]}
            </label>
          ))}
        </div>

        <div style={styles.buttonRow}>
          <button
            type="submit"
            disabled={isBusy || !text.trim()}
            style={{ ...styles.btn, ...styles.btnPrimary }}
          >
            {status === 'loading' ? '분석 중...' : '말하기'}
          </button>
          {isBusy && (
            <button
              type="button"
              onClick={stop}
              style={{ ...styles.btn, ...styles.btnStop }}
            >
              정지
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={isBusy || exporting || !text.trim()}
            style={{ ...styles.btn, ...styles.btnExport }}
          >
            {exporting ? '렌더링 중...' : '동영상 내보내기'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── 인라인 스타일 ────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 480,
    margin: '0 auto',
    padding: '2rem 1rem',
    fontFamily: "'Noto Sans KR', sans-serif",
    color: '#e8e8e8',
    background: '#0f0f1a',
    minHeight: '100vh',
  },
  title: {
    textAlign: 'center',
    fontSize: '1.4rem',
    marginBottom: '1.5rem',
    color: '#a0c4ff',
  },
  canvasWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1.5rem',
  },
  statusBadge: {
    fontSize: '0.8rem',
    color: '#888',
    letterSpacing: '0.05em',
  },
  error: {
    color: '#ff6b6b',
    textAlign: 'center',
    fontSize: '0.9rem',
    marginBottom: '1rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  textarea: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: 8,
    border: '1px solid #333',
    background: '#1a1a2e',
    color: '#e8e8e8',
    fontSize: '1rem',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  rateRow: {
    display: 'flex',
    gap: '1.5rem',
    justifyContent: 'center',
  },
  rateLabel: {
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  buttonRow: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'center',
  },
  btn: {
    padding: '0.6rem 1.8rem',
    borderRadius: 8,
    border: 'none',
    fontSize: '1rem',
    cursor: 'pointer',
    fontWeight: 600,
  },
  btnPrimary: {
    background: '#4a90d9',
    color: '#fff',
  },
  btnStop: {
    background: '#555',
    color: '#fff',
  },
  btnExport: {
    background: '#7c5cbf',
    color: '#fff',
  },
};
