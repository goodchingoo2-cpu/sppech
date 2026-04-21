/**
 * 커리큘럼 타입 — 맞춤한국어 시리즈 기반 구조화된 수업 스크립트.
 *
 * 핵심: LLM은 콘텐츠를 "생성"하지 않고, 여기 정의된 스크립트를 앱이 순회하며 실행한다.
 * LLM은 다음 두 가지에만 쓰인다:
 *   1) 학습자 발음 평가 (match/close/different/question)
 *   2) 학습자 질문 답변 (check 단계)
 */

import type { TutorExpression } from '../tutor/types.js';

export type StepKind =
  | 'intro'    // 단원·레슨 시작 인사. 말하고 자동 진행.
  | 'teach'    // 항목 설명. 말하고 자동 진행.
  | 'repeat'   // 따라하기 유도. 학습자 응답 평가 후 match→다음, close→재시도, question→답변.
  | 'check'    // 이해 확인/질문 시간. 학습자 자유 응답, LLM 답변 후 다음.
  | 'outro';   // 레슨 마무리. 말하고 다음 레슨/피커로.

export interface SlideMaterial {
  readonly title: string;
  /** 화면 중앙에 크게 표시할 글자/단어. Repeat 단계면 따라할 대상. */
  readonly focus?: string;
  /** focus 밑에 보조 표기 (로마자/발음 힌트). */
  readonly focusHint?: string;
  /** 본문 항목 목록. 예시 단어·영어 뜻 혼합 가능. */
  readonly bullets?: readonly string[];
  /** 영어 번역/설명 (초보 학습자용). */
  readonly english?: string;
  /** 예문 리스트: 한국어/영어 쌍. */
  readonly examples?: readonly { readonly ko: string; readonly en?: string }[];
}

export interface Step {
  readonly id: string;
  readonly kind: StepKind;
  /** 튜터가 말할 한국어 대사 (TTS+립싱크). */
  readonly speak: string;
  /** 우측 슬라이드 내용. */
  readonly slide: SlideMaterial;
  /** 아바타 표정. 기본 smile. */
  readonly expression?: TutorExpression;
  /** repeat 단계에서 허용되는 정답 변형. 하나라도 매칭되면 match로 판정. */
  readonly expected?: readonly string[];
  /** 학습자가 빗맞췄을 때 사용할 힌트 (튜터가 다시 말해줄 내용). */
  readonly retryHint?: string;
}

export interface Lesson {
  readonly id: string;
  readonly title: string;
  readonly titleEn?: string;
  readonly steps: readonly Step[];
}

export interface Unit {
  readonly id: string;
  readonly title: string;
  readonly titleEn?: string;
  /** 준비 상태. 아직 컨텐츠가 없으면 'stub'. */
  readonly status: 'ready' | 'stub';
  readonly lessons: readonly Lesson[];
}

export interface Curriculum {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly units: readonly Unit[];
}
