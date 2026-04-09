// ============================================================
// 수학 유틸리티 함수
// ============================================================

/**
 * 선형 보간 (Linear Interpolation)
 * t=0 → a, t=1 → b
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 값을 [min, max] 범위로 클램핑
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Catmull-Rom 스플라인 보간
 * 4개의 제어점(p0, p1, p2, p3)과 t ∈ [0, 1]로 p1~p2 사이를 부드럽게 보간
 *
 * 주로 자음 구간에서 인접 모음 간 입술 모양을 부드럽게 이어줄 때 사용
 */
export function catmullRom(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/**
 * RMS(Root Mean Square) 계산
 * 음소 구간 내 PCM 샘플의 에너지(진폭)를 0 이상의 값으로 반환
 */
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * 배열 전체를 0~1 범위로 정규화
 * 모든 값이 같으면(분모=0) 0으로 처리
 */
export function normalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return values.map(() => 0);
  return values.map((v) => (v - min) / range);
}

/**
 * 운율 가중치 공식 (가이드 §3)
 * w_t = a(1 - e^(-c * i_t)) / ((1 / d_t) + a)
 *
 * @param intensity 음의 세기 i_t (RMS 값, 0 이상)
 * @param duration  음절 길이 d_t (초, 0보다 커야 함)
 * @returns 논문식 원본 가중치 (0~1 범위)
 */
export function prosodicWeightRaw(intensity: number, duration: number): number {
  const a = 20;
  const c = 0.02;
  const dSafe = Math.max(duration, 0.001); // 0 나누기 방지
  const numerator = a * (1 - Math.exp(-c * Math.max(intensity, 0)));
  const denominator = (1 / dSafe) + a;
  return denominator === 0 ? 0 : numerator / denominator;
}
