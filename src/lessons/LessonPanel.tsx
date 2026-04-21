/**
 * 학습 UI 패널.
 *
 * - 상단: 카테고리 세그먼트 (자음·모음·기본음절·인사말·숫자·표현)
 * - 본문: 선택 카테고리의 레슨 카드 그리드
 * - 카드 클릭 → onSelect(text) 콜백으로 상위(App)에 전달
 *     상위에서 텍스트 입력을 채우고 자동 발화(TTS+립싱크)를 트리거한다.
 *
 * 진도·"학습완료" 마크 등은 현재 범위에서 제외 (추후 확장 여지).
 */

import { useState } from 'react';
import { LESSON_CATEGORIES, type LessonItem } from './data.js';

export interface LessonPanelProps {
  /** 카드 클릭 시 호출. 텍스트 값을 전달한다. */
  readonly onSelect: (text: string) => void;
}

export function LessonPanel({ onSelect }: LessonPanelProps) {
  const [activeId, setActiveId] = useState(LESSON_CATEGORIES[0]!.id);
  const active = LESSON_CATEGORIES.find((c) => c.id === activeId) ?? LESSON_CATEGORIES[0]!;

  return (
    <div style={styles.root}>
      <div style={styles.tabs}>
        {LESSON_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveId(c.id)}
            style={{
              ...styles.tab,
              ...(c.id === activeId ? styles.tabActive : null),
            }}
            title={c.description}
          >
            {c.title}
          </button>
        ))}
      </div>

      {active.description && <div style={styles.desc}>{active.description}</div>}

      <div style={styles.grid}>
        {active.items.map((item, idx) => (
          <LessonCard
            key={`${active.id}-${idx}`}
            item={item}
            onClick={() => onSelect(item.text)}
          />
        ))}
      </div>

      <div style={styles.hint}>
        카드를 누르면 아바타가 해당 표현을 말해 줍니다.
      </div>
    </div>
  );
}

function LessonCard({ item, onClick }: { item: LessonItem; onClick: () => void }) {
  return (
    <button onClick={onClick} style={styles.card}>
      <div style={styles.cardText}>{item.text}</div>
      {item.romanization && <div style={styles.cardRoman}>{item.romanization}</div>}
      {item.meaning && <div style={styles.cardMeaning}>{item.meaning}</div>}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '10px 4px',
  },
  tabs: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    background: '#0b1220',
    padding: 3,
    borderRadius: 8,
    border: '1px solid #334155',
  },
  tab: {
    flex: '1 1 auto',
    minWidth: 70,
    padding: '6px 10px',
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  tabActive: {
    background: '#3b82f6',
    color: 'white',
    fontWeight: 600,
  },
  desc: {
    fontSize: 12,
    color: '#94a3b8',
    padding: '0 4px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 8,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    padding: '10px 8px',
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#e2e8f0',
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'center',
    fontFamily: 'inherit',
    transition: 'background 0.12s, border-color 0.12s',
  },
  cardText: {
    fontSize: 17,
    fontWeight: 600,
    color: '#f8fafc',
    lineHeight: 1.3,
  },
  cardRoman: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  cardMeaning: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 1.3,
  },
  hint: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    padding: '4px 0 2px',
  },
};
