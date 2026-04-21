/**
 * 맞춤한국어 1권 커리큘럼 스크립트.
 *
 * 출처 기반: "Machum Hangugeo (맞춤한국어)" Book 1 (한국어교재 폴더 PDF).
 * 총 16단원 중 현재는 입문 핵심(1-3단원, 11단원)만 완성. 나머지는 stub.
 *
 * 각 Step의 speak 문장은 아바타 TTS로 나가므로:
 *  - 영어·로마자 섞지 않고 한국어 자연스러운 구어체로.
 *  - 길게 쓰지 말 것 (한 번에 100~150자 이내 권장).
 *
 * expected 배열은 STT 결과와 비교. 띄어쓰기·문장부호 무시하고 매칭되므로
 * 가능한 변형을 넉넉히 포함 (예: 자모 이름은 "기역" / "ㄱ" 둘 다).
 */

import type { Curriculum } from './types.js';

export const BOOK1_CURRICULUM: Curriculum = {
  id: 'machum1',
  title: '맞춤한국어 1권',
  subtitle: '한글 입문 · 기본 표현',
  units: [
    // ============================================================
    // Unit 1 — 기본 모음
    // ============================================================
    {
      id: 'u1',
      title: '1단원 · 기본 모음',
      titleEn: 'Simple Vowels',
      status: 'ready',
      lessons: [
        {
          id: 'u1-l1',
          title: '기본 모음 6개',
          titleEn: 'Basic Vowels 1',
          steps: [
            {
              id: 'intro',
              kind: 'intro',
              speak:
                '안녕하세요! 저는 한국어 선생님이에요. 오늘은 한국어 기본 모음 여섯 개를 배워볼게요. 저를 따라서 소리를 내보세요.',
              slide: {
                title: '기본 모음 6개',
                bullets: ['ㅏ · ㅓ · ㅗ · ㅜ · ㅡ · ㅣ'],
                english: "Let's learn 6 basic Korean vowels.",
              },
              expression: 'smile',
            },
            {
              id: 'a',
              kind: 'teach',
              speak: "첫 번째 모음은 '아'예요. 입을 크게 벌리고 '아'라고 말해요.",
              slide: {
                title: '모음 ㅏ',
                focus: 'ㅏ',
                focusHint: '[a]',
                bullets: ['아기 · baby', '아빠 · father', '아이 · child'],
                english: "Sound like 'a' in father.",
              },
              expression: 'encouraging',
            },
            {
              id: 'a-repeat',
              kind: 'repeat',
              speak: "따라해 보세요. 아.",
              slide: {
                title: '따라해 보세요',
                focus: 'ㅏ',
                focusHint: '[a]',
                english: 'Repeat after me: a',
              },
              expected: ['아', 'ㅏ', 'a'],
              retryHint: "입을 더 크게 벌려서 '아'라고 해보세요.",
            },
            {
              id: 'eo',
              kind: 'teach',
              speak: "다음은 '어'예요. 입을 조금만 벌리고 '어'라고 말해요.",
              slide: {
                title: '모음 ㅓ',
                focus: 'ㅓ',
                focusHint: '[eo]',
                bullets: ['어머니 · mother', '어제 · yesterday'],
                english: "Sound like 'uh' in 'utter'.",
              },
              expression: 'encouraging',
            },
            {
              id: 'eo-repeat',
              kind: 'repeat',
              speak: "따라해 보세요. 어.",
              slide: {
                title: '따라해 보세요',
                focus: 'ㅓ',
                focusHint: '[eo]',
              },
              expected: ['어', 'ㅓ', 'eo', 'uh'],
              retryHint: "입을 살짝만 벌리고 '어'라고 해보세요.",
            },
            {
              id: 'o',
              kind: 'teach',
              speak: "다음은 '오'예요. 입을 동그랗게 만들어서 '오'라고 말해요.",
              slide: {
                title: '모음 ㅗ',
                focus: 'ㅗ',
                focusHint: '[o]',
                bullets: ['오리 · duck', '오이 · cucumber'],
                english: "Sound like 'o' in 'more'.",
              },
              expression: 'encouraging',
            },
            {
              id: 'o-repeat',
              kind: 'repeat',
              speak: "따라해 보세요. 오.",
              slide: { title: '따라해 보세요', focus: 'ㅗ', focusHint: '[o]' },
              expected: ['오', 'ㅗ', 'o'],
              retryHint: "입을 동그랗게 '오' 모양으로 만들어 보세요.",
            },
            {
              id: 'u',
              kind: 'teach',
              speak: "'우'예요. 입술을 앞으로 내밀고 '우'라고 말해요.",
              slide: {
                title: '모음 ㅜ',
                focus: 'ㅜ',
                focusHint: '[u]',
                bullets: ['우유 · milk', '우산 · umbrella'],
                english: "Sound like 'oo' in 'pool'.",
              },
              expression: 'encouraging',
            },
            {
              id: 'u-repeat',
              kind: 'repeat',
              speak: "따라해 보세요. 우.",
              slide: { title: '따라해 보세요', focus: 'ㅜ', focusHint: '[u]' },
              expected: ['우', 'ㅜ', 'u', 'oo'],
              retryHint: "입술을 오므려서 '우'라고 해보세요.",
            },
            {
              id: 'eu',
              kind: 'teach',
              speak: "'으'예요. 입을 옆으로 살짝 벌리고 '으'라고 말해요.",
              slide: {
                title: '모음 ㅡ',
                focus: 'ㅡ',
                focusHint: '[eu]',
                bullets: ['음식 · food', '은행 · bank'],
                english: "A neutral vowel, like unstressed 'e'.",
              },
              expression: 'encouraging',
            },
            {
              id: 'eu-repeat',
              kind: 'repeat',
              speak: "따라해 보세요. 으.",
              slide: { title: '따라해 보세요', focus: 'ㅡ', focusHint: '[eu]' },
              expected: ['으', 'ㅡ', 'eu'],
              retryHint: "입을 양옆으로 살짝 벌리고 '으'라고 해보세요.",
            },
            {
              id: 'i',
              kind: 'teach',
              speak: "마지막은 '이'예요. 웃는 것처럼 입을 옆으로 벌리고 '이'라고 말해요.",
              slide: {
                title: '모음 ㅣ',
                focus: 'ㅣ',
                focusHint: '[i]',
                bullets: ['이름 · name', '이모 · aunt'],
                english: "Sound like 'ee' in 'see'.",
              },
              expression: 'encouraging',
            },
            {
              id: 'i-repeat',
              kind: 'repeat',
              speak: "따라해 보세요. 이.",
              slide: { title: '따라해 보세요', focus: 'ㅣ', focusHint: '[i]' },
              expected: ['이', 'ㅣ', 'i', 'ee'],
              retryHint: "웃는 것처럼 입을 옆으로 벌려 '이'라고 해보세요.",
            },
            {
              id: 'check',
              kind: 'check',
              speak: '여기까지 궁금한 점이 있으면 말씀해 주세요. 없으면 "없어요"라고 말씀해 주세요.',
              slide: {
                title: '질문 있어요?',
                english: 'Any questions? Say "없어요" if not.',
              },
              expression: 'thinking',
            },
            {
              id: 'outro',
              kind: 'outro',
              speak:
                '오늘은 기본 모음 여섯 개를 배웠어요. 아, 어, 오, 우, 으, 이. 잘 하셨어요! 수고하셨어요.',
              slide: {
                title: '오늘 배운 모음',
                bullets: ['ㅏ · ㅓ · ㅗ · ㅜ · ㅡ · ㅣ'],
                english: 'Great job today!',
              },
              expression: 'smile',
            },
          ],
        },
        {
          id: 'u1-l2',
          title: 'Y 계열 모음 4개',
          titleEn: 'Basic Vowels 2 (Y-series)',
          steps: [
            {
              id: 'intro',
              kind: 'intro',
              speak:
                '안녕하세요! 이번 시간에는 Y 소리가 들어간 모음 네 개를 배워볼게요.',
              slide: {
                title: 'Y 계열 모음',
                bullets: ['ㅑ · ㅕ · ㅛ · ㅠ'],
                english: 'Y-series vowels.',
              },
              expression: 'smile',
            },
            {
              id: 'ya',
              kind: 'teach',
              speak: "'야'예요. '이'에서 '아'로 빠르게 이어서 발음해요.",
              slide: {
                title: '모음 ㅑ',
                focus: 'ㅑ',
                focusHint: '[ya]',
                bullets: ['야구 · baseball'],
              },
            },
            {
              id: 'ya-repeat',
              kind: 'repeat',
              speak: '따라해 보세요. 야.',
              slide: { title: '따라해 보세요', focus: 'ㅑ', focusHint: '[ya]' },
              expected: ['야', 'ㅑ', 'ya'],
              retryHint: "'이-아'를 빠르게 이어보세요. 야.",
            },
            {
              id: 'yeo',
              kind: 'teach',
              speak: "'여'예요. '이'에서 '어'로 빠르게 이어서 발음해요.",
              slide: {
                title: '모음 ㅕ',
                focus: 'ㅕ',
                focusHint: '[yeo]',
                bullets: ['여자 · woman', '여름 · summer'],
              },
            },
            {
              id: 'yeo-repeat',
              kind: 'repeat',
              speak: '따라해 보세요. 여.',
              slide: { title: '따라해 보세요', focus: 'ㅕ', focusHint: '[yeo]' },
              expected: ['여', 'ㅕ', 'yeo'],
              retryHint: "'이-어'를 빠르게 이어서 '여'.",
            },
            {
              id: 'yo',
              kind: 'teach',
              speak: "'요'예요. '이'에서 '오'로 이어서 발음해요.",
              slide: {
                title: '모음 ㅛ',
                focus: 'ㅛ',
                focusHint: '[yo]',
                bullets: ['요리 · cooking'],
              },
            },
            {
              id: 'yo-repeat',
              kind: 'repeat',
              speak: '따라해 보세요. 요.',
              slide: { title: '따라해 보세요', focus: 'ㅛ', focusHint: '[yo]' },
              expected: ['요', 'ㅛ', 'yo'],
            },
            {
              id: 'yu',
              kind: 'teach',
              speak: "'유'예요. '이'에서 '우'로 이어서 발음해요.",
              slide: {
                title: '모음 ㅠ',
                focus: 'ㅠ',
                focusHint: '[yu]',
                bullets: ['우유 · milk'],
              },
            },
            {
              id: 'yu-repeat',
              kind: 'repeat',
              speak: '따라해 보세요. 유.',
              slide: { title: '따라해 보세요', focus: 'ㅠ', focusHint: '[yu]' },
              expected: ['유', 'ㅠ', 'yu'],
            },
            {
              id: 'outro',
              kind: 'outro',
              speak: 'Y 계열 모음 네 개를 다 배웠어요. 잘 하셨어요!',
              slide: {
                title: '오늘 배운 모음',
                bullets: ['ㅑ · ㅕ · ㅛ · ㅠ'],
              },
              expression: 'smile',
            },
          ],
        },
      ],
    },

    // ============================================================
    // Unit 2 — 기본 자음
    // ============================================================
    {
      id: 'u2',
      title: '2단원 · 기본 자음',
      titleEn: 'Simple Consonants',
      status: 'ready',
      lessons: [
        {
          id: 'u2-l1',
          title: '자음 이름 배우기 1',
          titleEn: 'Consonant Names 1',
          steps: [
            {
              id: 'intro',
              kind: 'intro',
              speak:
                '이번 시간에는 한국어 자음을 배워볼게요. 먼저 자음 일곱 개의 이름을 소개할게요.',
              slide: {
                title: '기본 자음 1',
                bullets: ['ㄱ · ㄴ · ㄷ · ㄹ · ㅁ · ㅂ · ㅅ'],
                english: "Let's learn consonant names.",
              },
              expression: 'smile',
            },
            {
              id: 'giyeok',
              kind: 'teach',
              speak: "이 글자는 '기역'이에요. 소리는 ㄱ, 가방의 '가' 처음 소리예요.",
              slide: {
                title: '자음 ㄱ',
                focus: 'ㄱ',
                focusHint: '기역 · [g/k]',
                bullets: ['가방 · bag', '가족 · family'],
              },
            },
            {
              id: 'giyeok-repeat',
              kind: 'repeat',
              speak: '따라해 보세요. 기역.',
              slide: { title: '따라해 보세요', focus: 'ㄱ', focusHint: '기역' },
              expected: ['기역', '기욱', 'ㄱ', 'giyeok'],
              retryHint: "또박또박 '기 · 역'이라고 해보세요.",
            },
            {
              id: 'nieun',
              kind: 'teach',
              speak: "이 글자는 '니은'이에요. 소리는 ㄴ, 나무의 '나' 처음 소리예요.",
              slide: {
                title: '자음 ㄴ',
                focus: 'ㄴ',
                focusHint: '니은 · [n]',
                bullets: ['나무 · tree', '나비 · butterfly'],
              },
            },
            {
              id: 'nieun-repeat',
              kind: 'repeat',
              speak: '따라해 보세요. 니은.',
              slide: { title: '따라해 보세요', focus: 'ㄴ', focusHint: '니은' },
              expected: ['니은', 'ㄴ', 'nieun'],
            },
            {
              id: 'digeut',
              kind: 'teach',
              speak: "이 글자는 '디귿'이에요. 소리는 ㄷ, 다리의 '다' 처음 소리예요.",
              slide: {
                title: '자음 ㄷ',
                focus: 'ㄷ',
                focusHint: '디귿 · [d/t]',
                bullets: ['다리 · leg', '달 · moon'],
              },
            },
            {
              id: 'digeut-repeat',
              kind: 'repeat',
              speak: '따라해 보세요. 디귿.',
              slide: { title: '따라해 보세요', focus: 'ㄷ', focusHint: '디귿' },
              expected: ['디귿', '디읃', 'ㄷ', 'digeut'],
            },
            {
              id: 'rieul',
              kind: 'teach',
              speak: "이 글자는 '리을'이에요. 소리는 ㄹ, L과 R 중간쯤이에요.",
              slide: {
                title: '자음 ㄹ',
                focus: 'ㄹ',
                focusHint: '리을 · [l/r]',
                bullets: ['라면 · ramen', '라디오 · radio'],
              },
            },
            {
              id: 'rieul-repeat',
              kind: 'repeat',
              speak: '따라해 보세요. 리을.',
              slide: { title: '따라해 보세요', focus: 'ㄹ', focusHint: '리을' },
              expected: ['리을', 'ㄹ', 'rieul'],
            },
            {
              id: 'mieum',
              kind: 'teach',
              speak: "이 글자는 '미음'이에요. 소리는 ㅁ, 엄마의 '마' 처음 소리예요.",
              slide: {
                title: '자음 ㅁ',
                focus: 'ㅁ',
                focusHint: '미음 · [m]',
                bullets: ['마음 · mind', '물 · water'],
              },
            },
            {
              id: 'mieum-repeat',
              kind: 'repeat',
              speak: '따라해 보세요. 미음.',
              slide: { title: '따라해 보세요', focus: 'ㅁ', focusHint: '미음' },
              expected: ['미음', 'ㅁ', 'mieum'],
            },
            {
              id: 'bieup',
              kind: 'teach',
              speak: "이 글자는 '비읍'이에요. 소리는 ㅂ, 바다의 '바' 처음 소리예요.",
              slide: {
                title: '자음 ㅂ',
                focus: 'ㅂ',
                focusHint: '비읍 · [b/p]',
                bullets: ['바다 · sea', '바람 · wind'],
              },
            },
            {
              id: 'bieup-repeat',
              kind: 'repeat',
              speak: '따라해 보세요. 비읍.',
              slide: { title: '따라해 보세요', focus: 'ㅂ', focusHint: '비읍' },
              expected: ['비읍', 'ㅂ', 'bieup'],
            },
            {
              id: 'siot',
              kind: 'teach',
              speak: "이 글자는 '시옷'이에요. 소리는 ㅅ, 사과의 '사' 처음 소리예요.",
              slide: {
                title: '자음 ㅅ',
                focus: 'ㅅ',
                focusHint: '시옷 · [s]',
                bullets: ['사과 · apple', '사람 · person'],
              },
            },
            {
              id: 'siot-repeat',
              kind: 'repeat',
              speak: '따라해 보세요. 시옷.',
              slide: { title: '따라해 보세요', focus: 'ㅅ', focusHint: '시옷' },
              expected: ['시옷', '시읏', 'ㅅ', 'siot'],
            },
            {
              id: 'check',
              kind: 'check',
              speak: '자음 일곱 개를 배웠어요. 궁금한 점 있으세요? 없으면 "없어요"라고 해 주세요.',
              slide: {
                title: '질문 있어요?',
                english: 'Any questions?',
              },
              expression: 'thinking',
            },
            {
              id: 'outro',
              kind: 'outro',
              speak:
                '오늘은 기역 니은 디귿 리을 미음 비읍 시옷을 배웠어요. 정말 잘 하셨어요!',
              slide: {
                title: '오늘 배운 자음',
                bullets: ['ㄱ 기역', 'ㄴ 니은', 'ㄷ 디귿', 'ㄹ 리을', 'ㅁ 미음', 'ㅂ 비읍', 'ㅅ 시옷'],
              },
              expression: 'smile',
            },
          ],
        },
      ],
    },

    // ============================================================
    // Unit 3 — 음절 만들기 (기초)
    // ============================================================
    {
      id: 'u3',
      title: '3단원 · 음절 만들기',
      titleEn: 'Syllable Formation',
      status: 'ready',
      lessons: [
        {
          id: 'u3-l1',
          title: '자음 + 모음 조합',
          titleEn: 'Consonant + Vowel',
          steps: [
            {
              id: 'intro',
              kind: 'intro',
              speak:
                '지금까지 배운 자음과 모음을 합치면 음절이 만들어져요. 자음 ㄱ에 모음 ㅏ를 붙이면 "가"가 돼요.',
              slide: {
                title: '자음 + 모음 = 음절',
                bullets: ['ㄱ + ㅏ = 가', 'ㄴ + ㅏ = 나', 'ㄷ + ㅏ = 다'],
                english: 'Consonant + Vowel = Syllable',
              },
              expression: 'smile',
            },
            {
              id: 'ga',
              kind: 'teach',
              speak: "'가'예요. 가방, 가족의 '가' 소리예요.",
              slide: { title: '가', focus: '가', focusHint: '[ga]', bullets: ['가방 · bag'] },
            },
            {
              id: 'ga-repeat',
              kind: 'repeat',
              speak: '따라해 보세요. 가.',
              slide: { title: '따라해 보세요', focus: '가' },
              expected: ['가', 'ga', '까'],
            },
            {
              id: 'na',
              kind: 'teach',
              speak: "'나'예요. 나무의 '나' 소리예요.",
              slide: { title: '나', focus: '나', focusHint: '[na]', bullets: ['나무 · tree'] },
            },
            {
              id: 'na-repeat',
              kind: 'repeat',
              speak: '따라해 보세요. 나.',
              slide: { title: '따라해 보세요', focus: '나' },
              expected: ['나', 'na'],
            },
            {
              id: 'da',
              kind: 'teach',
              speak: "'다'예요. 다리의 '다' 소리예요.",
              slide: { title: '다', focus: '다', focusHint: '[da]', bullets: ['다리 · bridge'] },
            },
            {
              id: 'da-repeat',
              kind: 'repeat',
              speak: '따라해 보세요. 다.',
              slide: { title: '따라해 보세요', focus: '다' },
              expected: ['다', 'da', '따'],
            },
            {
              id: 'ma',
              kind: 'teach',
              speak: "'마'예요. 엄마의 '마' 소리예요.",
              slide: { title: '마', focus: '마', focusHint: '[ma]', bullets: ['엄마 · mom'] },
            },
            {
              id: 'ma-repeat',
              kind: 'repeat',
              speak: '따라해 보세요. 마.',
              slide: { title: '따라해 보세요', focus: '마' },
              expected: ['마', 'ma'],
            },
            {
              id: 'check',
              kind: 'check',
              speak: '잘 하고 계세요. 궁금한 점이 있으면 말씀해 주세요.',
              slide: {
                title: '질문 있어요?',
                english: 'Any questions?',
              },
              expression: 'thinking',
            },
            {
              id: 'outro',
              kind: 'outro',
              speak: '자음과 모음을 합쳐서 가 나 다 마를 만들어 봤어요. 아주 잘 하셨어요!',
              slide: {
                title: '오늘 배운 음절',
                bullets: ['가 · 나 · 다 · 마'],
              },
              expression: 'smile',
            },
          ],
        },
      ],
    },

    // ============================================================
    // Unit 11 — 인사
    // ============================================================
    {
      id: 'u11',
      title: '11단원 · 인사하기',
      titleEn: 'Greetings',
      status: 'ready',
      lessons: [
        {
          id: 'u11-l1',
          title: '안녕하세요',
          titleEn: 'Hello, How are you?',
          steps: [
            {
              id: 'intro',
              kind: 'intro',
              speak: '이번 시간에는 한국에서 가장 많이 쓰는 인사말을 배워볼게요.',
              slide: {
                title: '인사 표현',
                bullets: ['안녕하세요', '감사합니다', '죄송합니다', '네 · 아니요'],
                english: 'Essential Korean greetings.',
              },
              expression: 'smile',
            },
            {
              id: 'hello',
              kind: 'teach',
              speak: "'안녕하세요'는 Hello, 안부 인사예요. 만났을 때, 헤어질 때 모두 써요.",
              slide: {
                title: '안녕하세요',
                focus: '안녕하세요',
                focusHint: 'annyeong-haseyo',
                english: 'Hello / How are you?',
                examples: [
                  { ko: '안녕하세요, 저는 민수예요.', en: 'Hello, I am Minsu.' },
                ],
              },
            },
            {
              id: 'hello-repeat',
              kind: 'repeat',
              speak: '따라해 보세요. 안녕하세요.',
              slide: { title: '따라해 보세요', focus: '안녕하세요', focusHint: 'annyeong-haseyo' },
              expected: ['안녕하세요', '안녕하세여', '안녕 하세요'],
              retryHint: '천천히, 안 · 녕 · 하 · 세 · 요.',
            },
            {
              id: 'thanks',
              kind: 'teach',
              speak: "'감사합니다'는 Thank you예요. 격식있게 고마움을 표현할 때 써요.",
              slide: {
                title: '감사합니다',
                focus: '감사합니다',
                focusHint: 'gamsa-hamnida',
                english: 'Thank you.',
              },
            },
            {
              id: 'thanks-repeat',
              kind: 'repeat',
              speak: '따라해 보세요. 감사합니다.',
              slide: { title: '따라해 보세요', focus: '감사합니다', focusHint: 'gamsa-hamnida' },
              expected: ['감사합니다', '감사 합니다', '고맙습니다'],
            },
            {
              id: 'sorry',
              kind: 'teach',
              speak: "'죄송합니다'는 I'm sorry예요. 미안함을 격식있게 표현할 때 써요.",
              slide: {
                title: '죄송합니다',
                focus: '죄송합니다',
                focusHint: 'joesong-hamnida',
                english: 'I am sorry.',
              },
            },
            {
              id: 'sorry-repeat',
              kind: 'repeat',
              speak: '따라해 보세요. 죄송합니다.',
              slide: { title: '따라해 보세요', focus: '죄송합니다', focusHint: 'joesong-hamnida' },
              expected: ['죄송합니다', '미안합니다'],
            },
            {
              id: 'yesno',
              kind: 'teach',
              speak: "'네'는 Yes, '아니요'는 No예요. 아주 짧지만 자주 써요.",
              slide: {
                title: '네 · 아니요',
                bullets: ['네 — Yes', '아니요 — No'],
              },
            },
            {
              id: 'yes-repeat',
              kind: 'repeat',
              speak: "따라해 보세요. 네.",
              slide: { title: '따라해 보세요', focus: '네', focusHint: '[ne]' },
              expected: ['네', 'ne', '예'],
            },
            {
              id: 'no-repeat',
              kind: 'repeat',
              speak: "따라해 보세요. 아니요.",
              slide: { title: '따라해 보세요', focus: '아니요', focusHint: 'aniyo' },
              expected: ['아니요', '아니오', 'aniyo'],
            },
            {
              id: 'check',
              kind: 'check',
              speak: '오늘 배운 표현 중에 궁금한 점이나 더 알고 싶은 게 있으세요?',
              slide: { title: '질문 있어요?', english: 'Any questions?' },
              expression: 'thinking',
            },
            {
              id: 'outro',
              kind: 'outro',
              speak:
                '오늘 안녕하세요, 감사합니다, 죄송합니다, 네, 아니요를 배웠어요. 한국 사람을 만나면 꼭 써 보세요. 수고하셨습니다!',
              slide: {
                title: '오늘 배운 표현',
                bullets: ['안녕하세요', '감사합니다', '죄송합니다', '네 · 아니요'],
              },
              expression: 'smile',
            },
          ],
        },
      ],
    },

    // ============================================================
    // Stub 단원들 — 추후 확장
    // ============================================================
    { id: 'u4', title: '4단원 · 복합 모음 1', titleEn: 'Compound Vowels 1', status: 'stub', lessons: [] },
    { id: 'u5', title: '5단원 · 복합 모음 2', titleEn: 'Compound Vowels 2', status: 'stub', lessons: [] },
    { id: 'u6', title: '6단원 · 쌍자음', titleEn: 'Double Consonants', status: 'stub', lessons: [] },
    { id: 'u8', title: '8단원 · 받침 1', titleEn: 'Final Consonants 1', status: 'stub', lessons: [] },
    { id: 'u9', title: '9단원 · 받침 2', titleEn: 'Final Consonants 2', status: 'stub', lessons: [] },
    { id: 'u12', title: '12단원 · 이것은 무엇이에요?', titleEn: 'What is this?', status: 'stub', lessons: [] },
    { id: 'u13', title: '13단원 · 네, 포도예요', titleEn: 'Yes, they are grapes', status: 'stub', lessons: [] },
    { id: 'u14', title: '14단원 · 여기는 어디예요?', titleEn: 'Where is this place?', status: 'stub', lessons: [] },
    { id: 'u15', title: '15단원 · 방에 고양이가 있어요', titleEn: 'There is a cat in the room', status: 'stub', lessons: [] },
    { id: 'u16', title: '16단원 · 어디에 있어요?', titleEn: 'Where is it?', status: 'stub', lessons: [] },
  ],
};

/** 모든 지원 커리큘럼 — 현재는 맞춤한국어 1권만. 추후 2~6권 추가 가능. */
export const CURRICULA: readonly Curriculum[] = [BOOK1_CURRICULUM];
