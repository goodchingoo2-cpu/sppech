/**
 * 스크립트 기반 튜터 세션 훅.
 *
 * 커리큘럼 → 단원(Unit) → 레슨(Lesson) → 스텝(Step)을 순서대로 진행한다.
 * LLM은 좁은 역할만 수행:
 *  - repeat 스텝: 학습자 STT 결과를 llmService.evaluate()로 판정
 *  - check 스텝: 학습자 질문을 llmService.answer()로 답변
 * 나머지(intro/teach/outro)는 순수 TTS+슬라이드 표시.
 *
 * 상태 전이:
 *   idle ──start(lesson)─▶ speaking(step.speak) ──TTS끝─┐
 *                                                       │
 *     ┌──────────────── kind=intro/teach ──────────────┘ 다음 스텝
 *     │ kind=repeat ─▶ listening ─▶ thinking(evaluate) ─▶
 *     │                        match → advance
 *     │                        close/different → 같은 스텝 재시도 (retryHint)
 *     │                        question → thinking(answer) → 같은 스텝 재시도
 *     │ kind=check  ─▶ listening ─▶ thinking(answer) ─▶ 다음 스텝
 *     │ kind=outro  ─▶ 완료 → ended
 *     └
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { avatarBus } from '../animation/avatarBus.js';
import { generateTimeline } from '../viseme/timeline.js';
import { ttsService } from '../tts/ttsService.js';
import { sttService } from '../stt/sttService.js';
import { llmService } from './llmService.js';
import type { TutorState, TutorTurn } from './types.js';
import type { Curriculum, Lesson, Step, Unit, SlideMaterial } from '../curriculum/types.js';

export interface UseTutorSessionOptions {
  readonly rate: number;
  readonly voice: SpeechSynthesisVoice | null;
  readonly muted: boolean;
}

export interface TutorProgress {
  readonly curriculum: Curriculum | null;
  readonly unit: Unit | null;
  readonly lesson: Lesson | null;
  readonly stepIndex: number;
  readonly totalSteps: number;
}

export interface UseTutorSessionResult {
  readonly state: TutorState;
  readonly slide: SlideMaterial | null;
  readonly turns: readonly TutorTurn[];
  readonly interim: string;
  readonly error: string | null;
  readonly progress: TutorProgress;
  readonly start: (lesson: Lesson, unit: Unit, curriculum: Curriculum) => void;
  readonly stop: () => void;
  readonly skipListening: () => void;
  readonly isLlmSupported: boolean;
  readonly isSttSupported: boolean;
}

const EMPTY_PROGRESS: TutorProgress = {
  curriculum: null,
  unit: null,
  lesson: null,
  stepIndex: 0,
  totalSteps: 0,
};

export function useTutorSession(opts: UseTutorSessionOptions): UseTutorSessionResult {
  const [state, setState] = useState<TutorState>('idle');
  const [slide, setSlide] = useState<SlideMaterial | null>(null);
  const [turns, setTurns] = useState<readonly TutorTurn[]>([]);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<TutorProgress>(EMPTY_PROGRESS);

  // 진행 상태 ref (setState 비동기라 콜백에서 실시간 추적 필요).
  const curriculumRef = useRef<Curriculum | null>(null);
  const unitRef = useRef<Unit | null>(null);
  const lessonRef = useRef<Lesson | null>(null);
  const stepIdxRef = useRef(0);
  /** repeat 스텝에서 재시도 횟수 (2회 close/different 시 3번째는 match 간주하여 진도 빼기). */
  const retryCountRef = useRef(0);

  const cancelSttRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const speakTimerRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  /** 진행 중인 모든 작업 취소. */
  const cancelAll = useCallback(() => {
    cancelSttRef.current?.();
    cancelSttRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    if (speakTimerRef.current !== null) {
      window.clearTimeout(speakTimerRef.current);
      speakTimerRef.current = null;
    }
    ttsService.stop();
    avatarBus.stop();
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    cancelAll();
    setState('idle');
    setInterim('');
    setProgress(EMPTY_PROGRESS);
    curriculumRef.current = null;
    unitRef.current = null;
    lessonRef.current = null;
    stepIdxRef.current = 0;
    retryCountRef.current = 0;
  }, [cancelAll]);

  /** 현재 스텝 가져오기. 없으면 null. */
  const currentStep = useCallback((): Step | null => {
    const lesson = lessonRef.current;
    if (!lesson) return null;
    return lesson.steps[stepIdxRef.current] ?? null;
  }, []);

  /** 진도 state를 ref에서 복사. */
  const pushProgress = useCallback(() => {
    const lesson = lessonRef.current;
    setProgress({
      curriculum: curriculumRef.current,
      unit: unitRef.current,
      lesson,
      stepIndex: stepIdxRef.current,
      totalSteps: lesson?.steps.length ?? 0,
    });
  }, []);

  /**
   * 주어진 문장을 발화하고 끝나면 콜백 실행.
   * 슬라이드/표정은 이 함수 바깥에서 미리 세팅해두는 게 원칙.
   */
  const speakAndThen = useCallback((text: string, after: () => void) => {
    if (stoppedRef.current) return;
    const o = optsRef.current;
    const frames = generateTimeline(text, { speed: o.rate });
    setState('speaking');
    setTurns((prev) => [...prev, { role: 'tutor', text }]);

    const done = () => {
      avatarBus.stop();
      if (stoppedRef.current) return;
      after();
    };

    if (o.muted || !ttsService.isSupported()) {
      avatarBus.play(frames);
      const totalMs = frames[frames.length - 1]?.endMs ?? 800;
      speakTimerRef.current = window.setTimeout(() => {
        speakTimerRef.current = null;
        done();
      }, totalMs);
      return;
    }

    ttsService.speak({
      text,
      rate: o.rate,
      voice: o.voice,
      onStart: () => avatarBus.play(frames),
      onEnd: done,
      onError: (err) => {
        console.warn('[TTS] error:', err);
        done();
      },
    });
  }, []);

  // 순환 참조 회피용 forward-declared ref (runStep ↔ advance ↔ handleRepeat).
  const runStepRef = useRef<() => void>(() => {});

  /** 스텝 포인터를 다음으로 옮기고 실행. 끝까지 다 돌았으면 ended. */
  const advance = useCallback(() => {
    if (stoppedRef.current) return;
    stepIdxRef.current += 1;
    retryCountRef.current = 0;
    pushProgress();
    const next = currentStep();
    if (!next) {
      setState('ended');
      return;
    }
    runStepRef.current();
  }, [currentStep, pushProgress]);

  /** 같은 스텝을 retryHint와 함께 재시도. */
  const retrySameStep = useCallback((hint: string) => {
    if (stoppedRef.current) return;
    retryCountRef.current += 1;
    // 같은 스텝에서 너무 많이 헤매면 강제로 넘어간다 (학습자 좌절 방지).
    if (retryCountRef.current >= 3) {
      speakAndThen('조금 어려우시죠? 괜찮아요. 다음으로 가 볼게요.', () => {
        advance();
      });
      return;
    }
    const step = currentStep();
    if (!step) return;
    speakAndThen(hint, () => {
      if (stoppedRef.current) return;
      // 재시도 시 다시 듣기 모드로.
      startListeningForRepeat(step);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advance, currentStep, speakAndThen]);

  /** repeat 스텝에서 학습자 발화를 평가. */
  const evaluateRepeat = useCallback(
    async (step: Step, transcript: string) => {
      if (stoppedRef.current) return;
      setState('thinking');
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const context = `${unitRef.current?.title ?? ''} · ${step.slide.title} (${step.slide.focus ?? ''})`;
      const result = await llmService.evaluate(
        step.expected ?? [],
        transcript,
        context,
        ctrl.signal,
      );
      if (stoppedRef.current) return;

      if (result.verdict === 'match') {
        speakAndThen(result.feedback, () => advance());
        return;
      }

      if (result.verdict === 'question') {
        // 학습자 질문 → answer로 넘어가고, 답변 후 같은 스텝 재시도.
        handleQuestion(step, transcript, /* backToRepeat */ true);
        return;
      }

      // close / different → retryHint로 재시도
      const hint = step.retryHint ?? result.feedback ?? '한 번 더 해볼까요?';
      const combined = result.feedback
        ? `${result.feedback} ${hint !== result.feedback ? hint : ''}`.trim()
        : hint;
      retrySameStep(combined);
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [advance, retrySameStep, speakAndThen],
  );

  /** 학습자 자유 질문을 LLM에 넘기고, 답변 후 흐름 복귀. */
  const handleQuestion = useCallback(
    async (step: Step, question: string, backToRepeat: boolean) => {
      if (stoppedRef.current) return;
      setState('thinking');
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const context = `${unitRef.current?.title ?? ''} / ${step.slide.title} ${
        step.slide.focus ? `(${step.slide.focus})` : ''
      } — ${step.speak}`;
      const answer = await llmService.answer(context, question, ctrl.signal);
      if (stoppedRef.current) return;

      speakAndThen(answer, () => {
        if (stoppedRef.current) return;
        if (backToRepeat) {
          // 다시 따라하기 유도.
          const again = step.retryHint ?? `자, 다시 "${step.slide.focus ?? ''}" 따라해 보세요.`;
          speakAndThen(again, () => startListeningForRepeat(step));
        } else {
          advance();
        }
      });
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [advance, speakAndThen],
  );

  /** repeat 스텝에서 마이크 열기. */
  const startListeningForRepeat = useCallback(
    (step: Step) => {
      if (stoppedRef.current) return;
      setInterim('');
      if (!sttService.isSupported()) {
        // STT 미지원 → 재시도 없이 match로 간주하고 넘어감 (수업이 멈추지 않도록).
        speakAndThen('(음성 인식 미지원 환경이라 그냥 넘어갈게요.)', () => advance());
        return;
      }
      setState('listening');
      cancelSttRef.current = sttService.listen({
        onInterim: (t) => setInterim(t),
        onFinal: (text, confidence) => {
          if (stoppedRef.current) return;
          setInterim('');
          setTurns((prev) => [...prev, { role: 'learner', text, confidence }]);
          evaluateRepeat(step, text);
        },
        onError: (err) => {
          if (stoppedRef.current) return;
          console.warn('[STT] error:', err);
          setInterim('');
          // 무응답/권한 등 — 재시도 유도.
          retrySameStep(step.retryHint ?? '소리가 잘 안 들렸어요. 다시 한 번 해볼까요?');
        },
        onEnd: () => {
          cancelSttRef.current = null;
        },
      });
    },
    [advance, evaluateRepeat, retrySameStep, speakAndThen],
  );

  /** check 스텝에서 자유 질문 받기. 질문 안 하고 침묵하면 바로 진도. */
  const startListeningForCheck = useCallback(
    (step: Step) => {
      if (stoppedRef.current) return;
      setInterim('');
      if (!sttService.isSupported()) {
        advance();
        return;
      }
      setState('listening');
      // check 단계는 타임아웃이 필요 — 학습자가 질문 없으면 15초 뒤 진도.
      const silenceTimer = window.setTimeout(() => {
        cancelSttRef.current?.();
      }, 15_000);

      cancelSttRef.current = sttService.listen({
        onInterim: (t) => setInterim(t),
        onFinal: (text, confidence) => {
          window.clearTimeout(silenceTimer);
          if (stoppedRef.current) return;
          setInterim('');
          setTurns((prev) => [...prev, { role: 'learner', text, confidence }]);
          if (!text.trim()) {
            advance();
            return;
          }
          handleQuestion(step, text, /* backToRepeat */ false);
        },
        onError: (err) => {
          window.clearTimeout(silenceTimer);
          if (stoppedRef.current) return;
          console.warn('[STT] error:', err);
          setInterim('');
          advance();
        },
        onEnd: () => {
          window.clearTimeout(silenceTimer);
          cancelSttRef.current = null;
        },
      });
    },
    [advance, handleQuestion],
  );

  /** 현재 스텝을 실행한다 (kind에 따라 분기). */
  const runStep = useCallback(() => {
    if (stoppedRef.current) return;
    const step = currentStep();
    if (!step) {
      setState('ended');
      return;
    }

    // 슬라이드·표정 먼저 세팅.
    setSlide(step.slide);
    avatarBus.setExpression(step.expression ?? 'smile');
    pushProgress();

    switch (step.kind) {
      case 'intro':
      case 'teach':
        speakAndThen(step.speak, () => advance());
        break;

      case 'repeat':
        speakAndThen(step.speak, () => startListeningForRepeat(step));
        break;

      case 'check':
        speakAndThen(step.speak, () => startListeningForCheck(step));
        break;

      case 'outro':
        speakAndThen(step.speak, () => advance());
        break;

      default: {
        // 알 수 없는 kind면 그냥 넘어감.
        advance();
      }
    }
  }, [advance, currentStep, pushProgress, speakAndThen, startListeningForCheck, startListeningForRepeat]);

  // runStep ref 최신화 (retrySameStep 등에서 역참조용).
  useEffect(() => {
    runStepRef.current = runStep;
  }, [runStep]);

  /** 레슨 시작. */
  const start = useCallback(
    (lesson: Lesson, unit: Unit, curriculum: Curriculum) => {
      stoppedRef.current = false;
      setError(null);
      setTurns([]);
      setSlide(null);
      setInterim('');
      curriculumRef.current = curriculum;
      unitRef.current = unit;
      lessonRef.current = lesson;
      stepIdxRef.current = 0;
      retryCountRef.current = 0;
      pushProgress();
      runStep();
    },
    [pushProgress, runStep],
  );

  const skipListening = useCallback(() => {
    if (state !== 'listening') return;
    cancelSttRef.current?.();
    cancelSttRef.current = null;
    setInterim('');
    // 건너뛰기 = 다음 스텝으로 바로 진행.
    advance();
  }, [state, advance]);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      cancelAll();
    };
  }, [cancelAll]);

  return {
    state,
    slide,
    turns,
    interim,
    error,
    progress,
    start,
    stop,
    skipListening,
    isLlmSupported: true,
    isSttSupported: sttService.isSupported(),
  };
}
