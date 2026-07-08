/**
 * Drumkit presets — *kit 패치*. 트랙당 하나. 각 트랙 인라인 드럼의 *들리는 상수* 를 그대로
 * 옮긴 것이라, 거의 같아 보여도(예: batheday 150→45 vs gratis 140→42) 합치지 않는다 —
 * *소리 보존* 이 기준. dedup 이득은 엔진(`createDrumKit`)이지
 * preset 수가 아니다.
 */

import type { DrumKitPreset, SnarePreset } from './drumkit'

// ──────────────────────────────────────────────────────────────────────────────
// Dry / Wet / Iron — *머신 어휘* 3 변주.
// ──────────────────────────────────────────────────────────────────────────────

/** dry-room — LinnDrum/DR-55 식 dry punch. tail 없는 마른 머신. */
export const DRY_KIT: DrumKitPreset = {
  kick: {
    body: {
      startHz: 135,
      endHz: 48,
      pitchTau: 0.06,
      attack: 0.004,
      attackCurve: 'lin',
      decay: 0.32,
      stop: 0.4,
    },
  },
  snare: {
    tone: { type: 'triangle', startHz: 220, level: 0.45, decay: 0.14, stop: 0.18 },
    noise: { bpHz: 1600, q: 0.8, prMin: 0.6, prMax: 1.0, level: 0.5, decay: 0.18, stop: 0.22 },
  },
  hat: {
    hpHz: 7200,
    hpQ: 0.6,
    prCenter: 1.0,
    prSpread: 0.1,
    attack: 0.002,
    closedDecay: 0.04,
    openDecay: 0.22,
    closedLevel: 1,
    openLevel: 1,
    stopPad: 0.05,
  },
}

/** wet-room — 깊고 긴 sine kick + *gated reverb* snare(In the Air Tonight). */
export const WET_KIT: DrumKitPreset = {
  kick: {
    body: {
      startHz: 110,
      endHz: 42,
      pitchTau: 0.09,
      attack: 0.006,
      attackCurve: 'lin',
      decay: 0.5,
      stop: 0.55,
    },
  },
  snare: {
    tone: { type: 'triangle', startHz: 200, level: 0.5, decay: 0.12, stop: 0.18 },
    noise: { bpHz: 1800, q: 0.9, prMin: 1.0, prMax: 1.0, level: 0.6, decay: 0.14, stop: 0.18 },
    gatedTails: [
      { centerHz: 1400, q: 1.2, level: 0.55, plateau: 0.18, cut: 0.02 },
      { centerHz: 450, q: 1.0, level: 0.4, plateau: 0.18, cut: 0.02 },
    ],
  },
}

/** iron-pulse — 산업 sub 펌프 kick(+click) + 거친 highpass grit(hat). */
export const IRON_KIT: DrumKitPreset = {
  kick: {
    body: {
      startHz: 95,
      endHz: 38,
      pitchTau: 0.05,
      attack: 0.003,
      attackCurve: 'lin',
      decay: 0.28,
      stop: 0.35,
    },
    click: { hpHz: 2200, level: 0.35, attack: 0.001, attackCurve: 'lin', decay: 0.012, stop: 0.03 },
  },
  // grit = 거친 highpass noise. open 모드 없이 closed 만 호출 — openDecay = closedDecay.
  hat: {
    hpHz: 6500,
    hpQ: 0.5,
    prCenter: 1.0,
    prSpread: 0.3,
    attack: 0.001,
    closedDecay: 0.035,
    openDecay: 0.035,
    closedLevel: 1,
    openLevel: 1,
    stopPad: 0.045,
  },
}

// ──────────────────────────────────────────────────────────────────────────────
// 블랙게이즈(batheday·sublime-hate) — kick(+click) + snare. crash 는 인라인.
// batheday === sublime-hate(완전 동일). gratis 는 본 추출 제외(아래 NOTE).
// ──────────────────────────────────────────────────────────────────────────────

/** batheday/gratis/sublime 공통 snare — bp1800 noise + 피치 envelope tone. */
const BLACKGAZE_SNARE: SnarePreset = {
  noise: { bpHz: 1800, q: 1.3, prMin: 1.0, prMax: 1.0, level: 0.6, decay: 0.2, stop: 0.25 },
  tone: {
    type: 'triangle',
    startHz: 260,
    endHz: 160,
    pitchTau: 0.08,
    level: 0.32,
    decay: 0.13,
    stop: 0.18,
  },
}

/** batheday — 블랙게이즈 계열 결의 kick/snare. */
export const BATHEDAY_KIT: DrumKitPreset = {
  kick: {
    body: {
      startHz: 150,
      endHz: 45,
      pitchTau: 0.07,
      attack: 0.004,
      attackCurve: 'lin',
      decay: 0.34,
      stop: 0.4,
    },
    click: { hpHz: 2200, level: 0.28, attack: 0.001, attackCurve: 'lin', decay: 0.01, stop: 0.03 },
  },
  snare: BLACKGAZE_SNARE,
}

/** sublime-hate — kick/snare 가 batheday 와 완전 동일. */
export const SUBLIME_KIT: DrumKitPreset = BATHEDAY_KIT

// NOTE: gratis 는 본 추출에서 제외 — gratis.ts 의 인라인 드럼 유지. 승격 시 GRATIS_KIT 추가
// (kick 만 미세차: body 140→42, click level 0.26. snare 는 BLACKGAZE_SNARE 공통).

/** reveal-the-truth — IDM 계열의 *snappy* kick(+click) + snare + hat. */
export const REVEAL_KIT: DrumKitPreset = {
  kick: {
    body: {
      startHz: 140,
      endHz: 42,
      pitchTau: 0.07,
      attack: 0.004,
      attackCurve: 'lin',
      decay: 0.38,
      stop: 0.45,
    },
    click: { hpHz: 1800, level: 0.25, attack: 0.001, attackCurve: 'lin', decay: 0.01, stop: 0.03 },
  },
  snare: {
    noise: { bpHz: 1700, q: 1.4, prMin: 1.0, prMax: 1.0, level: 0.55, decay: 0.18, stop: 0.25 },
    tone: {
      type: 'triangle',
      startHz: 240,
      endHz: 150,
      pitchTau: 0.08,
      level: 0.3,
      decay: 0.12,
      stop: 0.18,
    },
  },
  hat: {
    hpHz: 7200,
    prCenter: 1.0,
    prSpread: 0.3,
    attack: 0.001,
    closedDecay: 0.025,
    openDecay: 0.12,
    closedLevel: 1,
    openLevel: 1,
    stopPad: 0.02,
  },
}

// ──────────────────────────────────────────────────────────────────────────────
// Dub(relay·holy·power) — sub tail kick(exp attack, peak>velocity) + click.
// duck ramp·clap·rim·shimmer 는 트랙 인라인(엔진 밖). dub-relay/holy 는 hat 미사용.
// ──────────────────────────────────────────────────────────────────────────────

/** dub-relay — 144 BPM, 2-body sub kick. */
export const DUB_RELAY_KIT: DrumKitPreset = {
  kick: {
    body: {
      startHz: 130,
      endHz: 48,
      pitchTau: 0.08,
      attack: 0.004,
      attackCurve: 'exp',
      peakMul: 1.3,
      decay: 0.6,
      stop: 0.65,
    },
    sub: {
      startHz: 60,
      endHz: 38,
      pitchTau: 0.12,
      attack: 0.008,
      attackCurve: 'exp',
      peakMul: 0.95,
      decay: 0.45,
      stop: 0.5,
    },
    click: { hpHz: 2500, level: 0.4, attack: 0.001, attackCurve: 'exp', decay: 0.02, stop: 0.04 },
  },
  hat: {
    hpHz: 7800,
    bpHz: 9000,
    bpQ: 0.9,
    prCenter: 1.0,
    prSpread: 0.05,
    attack: 0.002,
    closedDecay: 0.035,
    openDecay: 0.13,
    closedLevel: 0.22,
    openLevel: 0.32,
    stopPad: 0.02,
  },
}

/** dub-holy — 70 BPM half-time, *더 깊고 긴* sub kick. hat 미사용. */
export const DUB_HOLY_KIT: DrumKitPreset = {
  kick: {
    body: {
      startHz: 140,
      endHz: 44,
      pitchTau: 0.1,
      attack: 0.005,
      attackCurve: 'exp',
      peakMul: 1.4,
      decay: 0.85,
      stop: 0.9,
    },
    sub: {
      startHz: 56,
      endHz: 36,
      pitchTau: 0.15,
      attack: 0.01,
      attackCurve: 'exp',
      peakMul: 1.05,
      decay: 0.7,
      stop: 0.75,
    },
    click: {
      hpHz: 2200,
      level: 0.32,
      attack: 0.0015,
      attackCurve: 'exp',
      decay: 0.025,
      stop: 0.05,
    },
  },
}

/** dub-power — 78 BPM, *권위의 박* kick + hat. */
export const DUB_POWER_KIT: DrumKitPreset = {
  kick: {
    body: {
      startHz: 140,
      endHz: 45,
      pitchTau: 0.1,
      attack: 0.005,
      attackCurve: 'exp',
      peakMul: 1.35,
      decay: 0.75,
      stop: 0.8,
    },
    sub: {
      startHz: 64.6,
      endHz: 38,
      pitchTau: 0.15,
      attack: 0.01,
      attackCurve: 'exp',
      peakMul: 1.05,
      decay: 0.6,
      stop: 0.65,
    },
    click: { hpHz: 2200, level: 0.32, attack: 0.001, attackCurve: 'exp', decay: 0.025, stop: 0.04 },
  },
  hat: {
    hpHz: 6500,
    bpHz: 7200,
    bpQ: 0.85,
    prCenter: 1.0,
    prSpread: 0.06,
    attack: 0.002,
    closedDecay: 0.045,
    openDecay: 0.22,
    closedLevel: 0.24,
    openLevel: 0.34,
    stopPad: 0.02,
  },
}
