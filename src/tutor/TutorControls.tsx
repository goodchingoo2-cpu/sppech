/**
 * 튜터 모드 하단 컨트롤 패널.
 *
 * 두 모드:
 *  - idle / ended 상태: 커리큘럼 피커 + "수업 시작" 버튼
 *  - 수업 진행 중:      대화 로그 + 건너뛰기 / 종료 버튼
 *
 * 항상 표시: 에러 배너, STT 미지원 경고
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TutorState, TutorTurn } from './types.js';
import type { Curriculum, Lesson, Unit } from '../curriculum/types.js';

interface Props {
  readonly state: TutorState;
  readonly turns: readonly TutorTurn[];
  readonly error: string | null;
  readonly isSttSupported: boolean;
  readonly curricula: readonly Curriculum[];
  readonly onStart: (lesson: Lesson, unit: Unit, curriculum: Curriculum) => void;
  readonly onStop: () => void;
  readonly onSkipListening: () => void;
}

export function TutorControls({
  state,
  turns,
  error,
  isSttSupported,
  curricula,
  onStart,
  onStop,
  onSkipListening,
}: Props) {
  const logRef = useRef<HTMLDivElement>(null);

  // 피커 선택 상태.
  const [curriculumId, setCurriculumId] = useState<string>(() => curricula[0]?.id ?? '');
  const curriculum = useMemo(
    () => curricula.find((c) => c.id === curriculumId) ?? curricula[0] ?? null,
    [curricula, curriculumId],
  );
  const readyUnits = useMemo(
    () => curriculum?.units.filter((u) => u.status === 'ready') ?? [],
    [curriculum],
  );
  const [unitId, setUnitId] = useState<string>(() => readyUnits[0]?.id ?? '');
  const unit = useMemo(
    () => readyUnits.find((u) => u.id === unitId) ?? readyUnits[0] ?? null,
    [readyUnits, unitId],
  );
  const [lessonId, setLessonId] = useState<string>(() => unit?.lessons[0]?.id ?? '');
  const lesson = useMemo(
    () => unit?.lessons.find((l) => l.id === lessonId) ?? unit?.lessons[0] ?? null,
    [unit, lessonId],
  );

  // 선택 값이 상위 목록 변동으로 유효하지 않게 되면 자동 보정.
  useEffect(() => {
    if (!readyUnits.some((u) => u.id === unitId) && readyUnits[0]) {
      setUnitId(readyUnits[0].id);
    }
  }, [readyUnits, unitId]);
  useEffect(() => {
    if (unit && !unit.lessons.some((l) => l.id === lessonId) && unit.lessons[0]) {
      setLessonId(unit.lessons[0].id);
    }
  }, [unit, lessonId]);

  // 새 턴이 추가되면 로그 바닥으로 스크롤.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const isRunning = state !== 'idle' && state !== 'ended';
  const isListening = state === 'listening';
  const canStart = !!(lesson && unit && curriculum);
  const stubCount = curriculum?.units.filter((u) => u.status === 'stub').length ?? 0;

  return (
    <div style={styles.root}>
      {error && (
        <div style={styles.error}>
          <strong>오류:</strong> {error}
          <div style={styles.errorHint}>
            LM Studio가 실행 중이고 <code>gemma4:e2b</code> 모델이 로드됐는지 확인하세요.
          </div>
        </div>
      )}

      {!isSttSupported && isRunning && (
        <div style={styles.warn}>
          이 브라우저는 음성 인식을 지원하지 않습니다. 수업은 계속되지만 학습자 응답을 기다리지 않고 자동 진행됩니다. (Chrome/Edge 권장)
        </div>
      )}

      {!isRunning ? (
        <>
          <div style={styles.pickerGrid}>
            <label style={styles.pickerCell}>
              <span style={styles.pickerLabel}>교재</span>
              <select
                value={curriculumId}
                onChange={(e) => setCurriculumId(e.target.value)}
                style={styles.select}
              >
                {curricula.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.pickerCell}>
              <span style={styles.pickerLabel}>단원</span>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                style={styles.select}
                disabled={readyUnits.length === 0}
              >
                {readyUnits.length === 0 ? (
                  <option>준비된 단원 없음</option>
                ) : (
                  readyUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.title}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label style={styles.pickerCell}>
              <span style={styles.pickerLabel}>레슨</span>
              <select
                value={lessonId}
                onChange={(e) => setLessonId(e.target.value)}
                style={styles.select}
                disabled={!unit || unit.lessons.length === 0}
              >
                {!unit || unit.lessons.length === 0 ? (
                  <option>레슨 없음</option>
                ) : (
                  unit.lessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                      {l.titleEn ? ` · ${l.titleEn}` : ''}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>

          {stubCount > 0 && (
            <div style={styles.stubHint}>
              ※ 이 교재의 {stubCount}개 단원은 아직 준비 중이라 선택할 수 없어요.
            </div>
          )}
        </>
      ) : (
        <div style={styles.log} ref={logRef}>
          {turns.length === 0 ? (
            <div style={styles.logEmpty}>수업이 곧 시작됩니다...</div>
          ) : (
            turns.slice(-8).map((t, i) => (
              <div
                key={`${turns.length}-${i}`}
                style={{
                  ...styles.turn,
                  ...(t.role === 'tutor' ? styles.turnTutor : styles.turnLearner),
                }}
              >
                <span style={styles.turnRole}>{t.role === 'tutor' ? '튜터' : '나'}</span>
                <span style={styles.turnText}>{t.text}</span>
                {typeof t.confidence === 'number' && (
                  <span style={styles.turnConf}>
                    {Math.round(t.confidence * 100)}%
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <div style={styles.buttons}>
        {!isRunning ? (
          <button
            onClick={() => {
              if (canStart) onStart(lesson!, unit!, curriculum!);
            }}
            style={{
              ...styles.btn,
              ...styles.btnPrimary,
              ...(canStart ? null : styles.btnDisabled),
            }}
            disabled={!canStart}
          >
            🎓 수업 시작
          </button>
        ) : (
          <>
            <button
              onClick={onSkipListening}
              style={styles.btn}
              disabled={!isListening}
              title={isListening ? '' : '응답 대기 중일 때만 사용할 수 있습니다'}
            >
              ⏭ 건너뛰기
            </button>
            <button onClick={onStop} style={{ ...styles.btn, ...styles.btnDanger }}>
              ✕ 수업 종료
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    padding: 12,
    background: '#111827',
    borderTop: '1px solid #1e293b',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  error: {
    padding: '8px 12px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: 6,
    color: '#fecaca',
    fontSize: 13,
  },
  errorHint: {
    marginTop: 4,
    fontSize: 11,
    color: '#fca5a5',
  },
  warn: {
    padding: '8px 12px',
    background: 'rgba(234, 179, 8, 0.1)',
    border: '1px solid rgba(234, 179, 8, 0.4)',
    borderRadius: 6,
    color: '#fde68a',
    fontSize: 12,
  },
  pickerGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 1.7fr)',
    gap: 8,
  },
  pickerCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  pickerLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: 600,
    letterSpacing: 0.3,
  },
  select: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #334155',
    background: '#0b1220',
    color: '#e2e8f0',
    fontSize: 13,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  stubHint: {
    fontSize: 11,
    color: '#64748b',
    paddingLeft: 2,
  },
  log: {
    maxHeight: 120,
    overflowY: 'auto',
    padding: '6px 8px',
    background: '#0b1220',
    border: '1px solid #1e293b',
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  logEmpty: {
    padding: '16px 8px',
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
  },
  turn: {
    display: 'flex',
    gap: 8,
    fontSize: 13,
    lineHeight: 1.4,
    alignItems: 'baseline',
  },
  turnTutor: {
    color: '#bfdbfe',
  },
  turnLearner: {
    color: '#a7f3d0',
  },
  turnRole: {
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.3,
    minWidth: 32,
  },
  turnText: {
    flex: 1,
    wordBreak: 'break-word',
  },
  turnConf: {
    flexShrink: 0,
    fontSize: 10,
    color: '#64748b',
  },
  buttons: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
  },
  btn: {
    padding: '10px 20px',
    border: '1px solid #334155',
    background: '#1e293b',
    color: '#e2e8f0',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnPrimary: {
    background: '#3b82f6',
    border: '1px solid #3b82f6',
    color: 'white',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  btnDanger: {
    background: '#991b1b',
    border: '1px solid #b91c1c',
    color: 'white',
  },
};
