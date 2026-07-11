/**
 * Stage 프리셋 — 스테이지의 *색*. wall 프리셋과 이름·무드로 짝을 맞춘다. VJ 가 "벽"을 고르면
 * 배경도 그 색이 되도록. 새 룩 → 새 상수(엔진을 건드리지 말 것 — presets are plain data).
 *
 * `warp`/`grain`/`feedback` 는 GL 스테이지(createGlStage) 전용 아트 노브 — 2D 는 무시한다.
 */
import type { StagePreset } from './stage'

/** SUNWALL 짝 — 웜 앰버 블룸. 느린 멜트, 두꺼운 트레일. */
export const SUN_STAGE: StagePreset = {
  bg: '#0b0600',
  ink: ['#ffb347', '#ff7a18', '#ffd782'],
  bloom: 1,
  bandSplit: [0.1, 0.5],
  mark: 'field',
  decay: 0.9,
  warp: 1.1,
  grain: 0.05,
  feedback: 0.965,
}

/** BLACKWALL 짝 — 근-블랙 + 화이트 스캔라인. 건조하고 짧은 잔상, 강한 그레인. */
export const BLACK_STAGE: StagePreset = {
  bg: '#000000',
  ink: ['#f5f5f5', '#9aa0a6', '#ffffff'],
  bloom: 0.4,
  bandSplit: [0.08, 0.45],
  mark: 'scanline',
  decay: 0.82,
  warp: 0.5,
  grain: 0.12,
  feedback: 0.9,
}

/** BLUEWALL 짝 — 콜드 시안 필드. */
export const BLUE_STAGE: StagePreset = {
  bg: '#020814',
  ink: ['#4fd1ff', '#1f7ae0', '#a6ecff'],
  bloom: 0.9,
  bandSplit: [0.12, 0.55],
  mark: 'bars',
  decay: 0.88,
  warp: 0.9,
  grain: 0.05,
  feedback: 0.95,
}

/** SUBLIME_HATE_WALL 짝 — 고대비 노이즈 링. 격한 워프. */
export const HATE_STAGE: StagePreset = {
  bg: '#0a0000',
  ink: ['#ff2d2d', '#ffffff', '#ff6a00'],
  bloom: 1,
  bandSplit: [0.05, 0.6],
  mark: 'rings',
  decay: 0.86,
  warp: 1.6,
  grain: 0.08,
  feedback: 0.94,
}
