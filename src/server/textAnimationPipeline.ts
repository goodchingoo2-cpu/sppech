import { buildFrameData } from '../animation/frameDataBuilder.js';
import { parseText } from '../input/textParser.js';
import type { RemotionFrameData, PhonemeToken } from '../input/types.js';
import { applyG2PRulesAll } from '../korean/g2pRules.js';
import {
  assignTimings,
  retimeToDuration,
  type SpeechRate,
} from '../korean/phonemeTiming.js';
import { mapToVisemes } from '../viseme/visemeMapper.js';

export interface TextAnimationPipelineOptions {
  rate?: SpeechRate;
  fps?: number;
  targetDurationSec?: number;
}

export interface TextAnimationPipelineResult {
  tokens: PhonemeToken[];
  frames: RemotionFrameData[];
  durationSec: number;
  fps: number;
}

export function buildTextAnimationData(
  text: string,
  options: TextAnimationPipelineOptions = {}
): TextAnimationPipelineResult {
  const rate = options.rate ?? 'normal';
  const fps = options.fps ?? 30;

  const partial = parseText(text);
  const timed = assignTimings(partial, { rate });
  const retimed = options.targetDurationSec
    ? retimeToDuration(timed, options.targetDurationSec)
    : timed;
  const withG2P = applyG2PRulesAll(retimed);
  const visemes = mapToVisemes(withG2P);
  const frames = buildFrameData(visemes, fps);
  const durationSec = frames.length > 0 ? (frames[frames.length - 1].frameIndex + 1) / fps : 0;

  return {
    tokens: withG2P,
    frames,
    durationSec,
    fps,
  };
}
