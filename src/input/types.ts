// ============================================================
// 한국어 스피치 애니메이션 시스템 — 공유 타입 정의
// ============================================================

/** 입술 모델 ID (L1~L9)
 * L1:ㅏ  L2:ㅐ/ㅔ  L3:ㅓ  L4:ㅗ  L5:ㅜ  L6:ㅡ  L7:ㅣ
 * L8: j계열 반모음  L9: w계열 반모음 / 양순음 폐구
 */
export type LipModel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8' | 'L9';

/** 자음 혀 모델 ID (T1~T7) */
export type ConsonantTongueModel = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7';

/** 모음 혀 모델 ID (VT1~VT5) */
export type VowelTongueModel = 'VT1' | 'VT2' | 'VT3' | 'VT4' | 'VT5';

/** 전체 혀 모델 */
export type TongueModel = ConsonantTongueModel | VowelTongueModel;

/** 음소 위치 */
export type PhonemePosition = 'onset' | 'nucleus' | 'coda' | 'pause';

/** 동시조음 블렌딩 대상 */
export interface BlendTarget {
  model: LipModel;
  weight: number;
}

/** 음소 토큰 — MFA 파싱 + 오디오 분석 결과를 통합한 단위 */
export interface PhonemeToken {
  /** 자모 문자 (ㄱ, ㅏ 등). pause의 경우 빈 문자열 */
  jamo: string;
  /** 음절 내 위치 */
  position: PhonemePosition;
  /** 시작 시각 (초) */
  start: number;
  /** 종료 시각 (초) */
  end: number;
  /** 지속 시간 = end - start */
  duration: number;
  /** RMS 진폭 (0~1 정규화) */
  intensity: number;
  /** 모음 여부 */
  isVowel: boolean;
  /** 쉼(묵음) 여부 */
  isPause: boolean;
  /** 이중모음 여부 */
  isDiphthong: boolean;
}

/** Viseme 프레임 — 하나의 시간 구간에 대응하는 입술/혀 모델 정보 */
export interface VisemeFrame {
  /** 프레임 시작 시각 (초) */
  timeStart: number;
  /** 프레임 종료 시각 (초) */
  timeEnd: number;
  /** 입술 모델 (null = 자음 구간이므로 스플라인 보간 필요) */
  lipModel: LipModel | null;
  /** 혀 모델 */
  tongueModel: TongueModel | null;
  /** 입술 가중치 0.0 ~ 1.0 */
  lipWeight: number;
  /** 혀 가중치 0.0 ~ 1.0 */
  tongueWeight: number;
  /** 동시조음 블렌딩 (규칙 9, 11에서 사용) */
  blendWith?: BlendTarget;
}

/** Remotion 렌더링용 프레임 데이터 (frameIndex 기준) */
export interface RemotionFrameData {
  /** Remotion 프레임 번호 (0부터) */
  frameIndex: number;
  lipModel: LipModel;
  tongueModel: TongueModel;
  lipWeight: number;
  tongueWeight: number;
  /** 블렌딩 대상 입술 모델 (규칙 9, 11) */
  blendModel?: LipModel;
  /** 블렌딩 가중치 */
  blendWeight?: number;
  /** Path 모핑 대상 모델 (모델 전환 구간에서 사용) */
  morphTarget?: LipModel;
  /** Path 모핑 진행도 0~1 */
  morphT?: number;
}

/** MFA TextGrid 파싱 결과 (단어 단위) */
export interface MFAWord {
  word: string;
  start: number;
  end: number;
  phonemes: MFAPhoneme[];
}

/** MFA TextGrid 파싱 결과 (음소 단위) */
export interface MFAPhoneme {
  /** MFA 레이블 (예: 'a', 'b', 'p_h' 등) */
  label: string;
  start: number;
  end: number;
}
