/**
 * Visual stage — synth-kit 의 소리를 프레임 단위로 동기화된 *제너러티브 비주얼* 로. 단일 진입 배럴.
 *
 * 오디오 엔진과 동형: `createVisualStage`(색-불문 렌더러) + `StagePreset`(색) + `createVisualSync`
 * (scheduler→canvas 브릿지). 소비 코드는 *오직 이 배럴*(`./visual`)로만 import — deep import 비지원.
 */

export { createGlStage } from './gl-stage'
export { createVisualStage, type HitKind, type StagePreset, type VisualStageHandle } from './stage'
export { BLACK_STAGE, BLUE_STAGE, HATE_STAGE, SUN_STAGE } from './stages'
export { createVisualSync, type VisualSync } from './sync'
