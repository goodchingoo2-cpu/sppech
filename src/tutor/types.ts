/**
 * 튜터 모듈 공통 타입.
 */

import type { ExpressionName } from '../animation/ExpressionPreset.js';

export type TutorExpectation = 'user_repeat' | 'user_answer' | 'none' | 'end';

/** LLM 응답에서 허용되는 표정 값. ExpressionPreset의 것과 일치시킴. */
export type TutorExpression = ExpressionName;

export interface TutorSlide {
  readonly title: string;
  readonly bullets: readonly string[];
  readonly focus?: string;
}

export interface TutorResponse {
  readonly speak: string;
  readonly slide: TutorSlide;
  readonly expect: TutorExpectation;
  readonly expression: TutorExpression;
}

export type TutorState =
  | 'idle'      // 수업 시작 전
  | 'thinking'  // LLM 호출 중
  | 'speaking'  // 아바타 발화 중
  | 'listening' // 마이크로 사용자 입력 대기
  | 'ended';    // 수업 종료

export interface TutorTurn {
  readonly role: 'tutor' | 'learner';
  readonly text: string;
  /** STT 신뢰도 (learner 턴 한정). */
  readonly confidence?: number;
}
