/**
 * Bass synth — *저역* 어휘의 공유 합성 엔진. 단일 진입 배럴.
 *
 * 소비 코드는 *오직 이 배럴* 로만 import — deep import 는 지원 대상이 아니다.
 */

export {
  type BassHandle,
  type BassPreset,
  createBass,
  type ReesePreset,
  type SubPreset,
} from './bass'
export { DUB_HOLY_BASS, DUB_POWER_BASS, DUB_RELAY_BASS } from './basses'
