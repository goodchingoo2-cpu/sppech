/**
 * 튜터 LLM 시스템 프롬프트.
 *
 * LLM은 두 가지 경우에만 호출된다:
 *  1) evaluate() — repeat 스텝에서 유사도 판정이 애매한 경우에만 (대부분은 규칙 처리)
 *  2) answer()   — check 스텝에서 학생이 자유 질문을 했을 때만
 *
 * wllama CPU 추론 특성상 입력 토큰이 적을수록 빠르다.
 * 두 프롬프트 모두 최소 길이로 유지한다.
 */

/**
 * evaluate() 전용.
 * 입력: 짧은 JSON (키 축약).
 * 출력: JSON 한 줄만. 다른 텍스트 절대 금지.
 */
export const EVAL_SYSTEM_PROMPT = `한국어 발음 채점관. 외국인 학생 평가.
입력: {"e":["정답들"],"l":"학생발화","q":질문여부}
출력(JSON 한 줄만): {"v":"match|close|different|question","f":"피드백30자이내"}
판정: match=거의정답 / close=비슷하나오류 / different=전혀다름 / question=학생이질문(q=true또는?·왜·어떻게포함)
f=구어체 한국어. 예:"잘하셨어요!" "입 더 크게요." "좋은 질문!"`;

/**
 * answer() 전용.
 * 출력: 순수 한국어 1~2문장. JSON·마크다운 절대 금지.
 */
export const ANSWER_SYSTEM_PROMPT = `외국인 초보 한국어 학생 1:1 튜터.
한국어만. 1~2문장. 70자 이내. 쉬운말. 끝에 복귀멘트("다시 해봐요!" 등).`;
