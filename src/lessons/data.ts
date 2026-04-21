/**
 * 학습 레슨 데이터.
 *
 * 구성: 자음 → 모음 → 기본 음절 → 인사말 → 숫자 → 일상 표현 → 짧은 문장
 * 진행 난이도는 대략 TOPIK 입문~초급(1급) 범위.
 *
 * 필드:
 *   text        : 학습자가 듣고/따라할 한국어 문자열 (TTS·립싱크 대상)
 *   meaning     : 해당 문자열의 뜻/번역 (초보 학습자용 힌트)
 *   romanization: 선택적 로마자 표기. 자모·초급 단어에서만 유용하므로 모든 항목에 넣지 않음.
 *
 * 확장 가이드:
 *   - 한 카테고리당 12~20개가 UI 가독성에 적절.
 *   - 너무 길어지는 경우 서브카테고리로 분리 권장.
 */

export interface LessonItem {
  readonly text: string;
  readonly meaning?: string;
  readonly romanization?: string;
}

export interface LessonCategory {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly items: readonly LessonItem[];
}

export const LESSON_CATEGORIES: readonly LessonCategory[] = [
  {
    id: 'consonants',
    title: '자음',
    description: '한글 기본 자음 14개',
    items: [
      { text: '기역', meaning: 'ㄱ', romanization: 'giyeok' },
      { text: '니은', meaning: 'ㄴ', romanization: 'nieun' },
      { text: '디귿', meaning: 'ㄷ', romanization: 'digeut' },
      { text: '리을', meaning: 'ㄹ', romanization: 'rieul' },
      { text: '미음', meaning: 'ㅁ', romanization: 'mieum' },
      { text: '비읍', meaning: 'ㅂ', romanization: 'bieup' },
      { text: '시옷', meaning: 'ㅅ', romanization: 'siot' },
      { text: '이응', meaning: 'ㅇ', romanization: 'ieung' },
      { text: '지읒', meaning: 'ㅈ', romanization: 'jieut' },
      { text: '치읓', meaning: 'ㅊ', romanization: 'chieut' },
      { text: '키읔', meaning: 'ㅋ', romanization: 'kieuk' },
      { text: '티읕', meaning: 'ㅌ', romanization: 'tieut' },
      { text: '피읖', meaning: 'ㅍ', romanization: 'pieup' },
      { text: '히읗', meaning: 'ㅎ', romanization: 'hieut' },
    ],
  },
  {
    id: 'vowels',
    title: '모음',
    description: '한글 기본 모음 10개',
    items: [
      { text: '아', meaning: 'ㅏ', romanization: 'a' },
      { text: '야', meaning: 'ㅑ', romanization: 'ya' },
      { text: '어', meaning: 'ㅓ', romanization: 'eo' },
      { text: '여', meaning: 'ㅕ', romanization: 'yeo' },
      { text: '오', meaning: 'ㅗ', romanization: 'o' },
      { text: '요', meaning: 'ㅛ', romanization: 'yo' },
      { text: '우', meaning: 'ㅜ', romanization: 'u' },
      { text: '유', meaning: 'ㅠ', romanization: 'yu' },
      { text: '으', meaning: 'ㅡ', romanization: 'eu' },
      { text: '이', meaning: 'ㅣ', romanization: 'i' },
    ],
  },
  {
    id: 'syllables',
    title: '기본 음절',
    description: '자음 + 모음 조합 연습',
    items: [
      { text: '가', meaning: 'ㄱ+ㅏ', romanization: 'ga' },
      { text: '나', meaning: 'ㄴ+ㅏ', romanization: 'na' },
      { text: '다', meaning: 'ㄷ+ㅏ', romanization: 'da' },
      { text: '라', meaning: 'ㄹ+ㅏ', romanization: 'ra' },
      { text: '마', meaning: 'ㅁ+ㅏ', romanization: 'ma' },
      { text: '바', meaning: 'ㅂ+ㅏ', romanization: 'ba' },
      { text: '사', meaning: 'ㅅ+ㅏ', romanization: 'sa' },
      { text: '아', meaning: 'ㅇ+ㅏ', romanization: 'a' },
      { text: '자', meaning: 'ㅈ+ㅏ', romanization: 'ja' },
      { text: '하', meaning: 'ㅎ+ㅏ', romanization: 'ha' },
      { text: '고', meaning: 'ㄱ+ㅗ', romanization: 'go' },
      { text: '노', meaning: 'ㄴ+ㅗ', romanization: 'no' },
      { text: '모', meaning: 'ㅁ+ㅗ', romanization: 'mo' },
      { text: '보', meaning: 'ㅂ+ㅗ', romanization: 'bo' },
    ],
  },
  {
    id: 'greetings',
    title: '인사말',
    description: '일상에서 가장 많이 쓰는 인사',
    items: [
      { text: '안녕하세요.', meaning: '안녕 / Hello' },
      { text: '안녕히 가세요.', meaning: 'Goodbye (to someone leaving)' },
      { text: '안녕히 계세요.', meaning: 'Goodbye (said by the one leaving)' },
      { text: '만나서 반갑습니다.', meaning: 'Nice to meet you' },
      { text: '감사합니다.', meaning: 'Thank you' },
      { text: '고맙습니다.', meaning: 'Thank you (softer)' },
      { text: '죄송합니다.', meaning: 'I am sorry' },
      { text: '괜찮아요.', meaning: 'It is okay' },
      { text: '잘 부탁드립니다.', meaning: 'Please take care of me / Pleased to work with you' },
      { text: '오랜만이에요.', meaning: 'Long time no see' },
      { text: '어서 오세요.', meaning: 'Welcome' },
      { text: '잘 지냈어요?', meaning: 'Have you been well?' },
    ],
  },
  {
    id: 'numbers',
    title: '숫자 (고유어)',
    description: '하나·둘·셋 …',
    items: [
      { text: '하나', meaning: 'one' },
      { text: '둘', meaning: 'two' },
      { text: '셋', meaning: 'three' },
      { text: '넷', meaning: 'four' },
      { text: '다섯', meaning: 'five' },
      { text: '여섯', meaning: 'six' },
      { text: '일곱', meaning: 'seven' },
      { text: '여덟', meaning: 'eight' },
      { text: '아홉', meaning: 'nine' },
      { text: '열', meaning: 'ten' },
    ],
  },
  {
    id: 'expressions',
    title: '일상 표현',
    description: '짧은 문장으로 말해보기',
    items: [
      { text: '저는 학생입니다.', meaning: 'I am a student' },
      { text: '이름이 뭐예요?', meaning: 'What is your name?' },
      { text: '제 이름은 민수예요.', meaning: 'My name is Minsu' },
      { text: '어디에서 왔어요?', meaning: 'Where are you from?' },
      { text: '한국어를 공부해요.', meaning: 'I am studying Korean' },
      { text: '오늘 날씨가 좋아요.', meaning: 'The weather is nice today' },
      { text: '배가 고파요.', meaning: 'I am hungry' },
      { text: '물 좀 주세요.', meaning: 'Please give me some water' },
      { text: '화장실이 어디예요?', meaning: 'Where is the restroom?' },
      { text: '얼마예요?', meaning: 'How much is it?' },
      { text: '천천히 말해 주세요.', meaning: 'Please speak slowly' },
      { text: '다시 한 번 말해 주세요.', meaning: 'Please say it one more time' },
    ],
  },
];
