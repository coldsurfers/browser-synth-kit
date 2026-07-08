/**
 * Drumkit synth — *타악* 어휘의 공유 합성 엔진. 단일 진입 배럴.
 *
 * 소비 코드는 *오직 이 배럴* 로만 import — deep import 는 지원 대상이 아니다.
 */

export {
  createDrumKit,
  type DrumKitHandle,
  type DrumKitPreset,
  type GatedTail,
  type HatPreset,
  type KickBody,
  type KickClick,
  type KickPreset,
  type SnareNoise,
  type SnarePreset,
  type SnareTone,
} from './drumkit'
export {
  BATHEDAY_KIT,
  DRY_KIT,
  DUB_HOLY_KIT,
  DUB_POWER_KIT,
  DUB_RELAY_KIT,
  IRON_KIT,
  REVEAL_KIT,
  SUBLIME_KIT,
  WET_KIT,
} from './kits'
