/**
 * Dub chamber — dub 트랙의 *마스터/믹스 챔버*(사이드체인 duck · dub delay return · tape
 * saturation) 공유 엔진. 단일 진입 배럴.
 *
 * 소비 코드는 *오직 이 배럴* 로만 import — deep import 는 지원 대상이 아니다.
 */

export {
  createDubChamber,
  type DelayStage,
  type DubChamber,
  type DubChamberPreset,
  type DuckStage,
  type FadeStage,
  type MasterStage,
} from './chamber'
export { CRUSH_CHAMBER, DUB_HOLY_CHAMBER, DUB_POWER_CHAMBER, DUB_RELAY_CHAMBER } from './chambers'
