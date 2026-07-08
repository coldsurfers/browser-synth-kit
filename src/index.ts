/**
 * Sunwall synth — *벽* 어휘의 공유 합성 엔진. 단일 진입 배럴.
 *
 * 소비 코드는 *오직 이 배럴* 로만 import — deep import 는 지원 대상이 아니다.
 *
 * drumkit(`./drumkit`)·dub chamber(`./dub`)·bass(`./bass`)·space(`./space`)는 자체 sub-barrel.
 * 색-불문 transport 헬퍼 `runStepClock` 은 본 배럴에서 함께 노출.
 */

export {
  type BassHandle,
  type BassPreset,
  createBass,
  DUB_HOLY_BASS,
  DUB_POWER_BASS,
  DUB_RELAY_BASS,
  type ReesePreset,
  type SubPreset,
} from './bass'
export { runStepClock, type StepClock, type StepClockOptions } from './scheduler'
export { createStrip, type StripHandle, type StripPreset } from './space'
export {
  BLACKWALL,
  BLUEWALL,
  createWall,
  GRATIS_WALL,
  makeDistortionCurve,
  SUBLIME_HATE_WALL,
  SUNWALL,
  type WallBend,
  type WallHandle,
  type WallPreset,
  type WallTrem,
  WHITEWALL,
} from './sunwall'
