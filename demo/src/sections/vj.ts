/**
 * "VJ Backdrop" — the generative track from tape.ts, now driving a frame-synced
 * fullscreen visual. Same shoegaze/wall track; an AnalyserNode tapped off the
 * master feeds the continuous background, and the sequencer emits discrete hits
 * (kick / chord) that flash *in sync* via createVisualSync's lookahead-aware queue.
 *
 * This is commercialization ④ v1: sync to synth-kit's own deterministic track.
 * (v2 = live band line-in through the same stage — analyser only, no step events.)
 */
import { createStrip, createWall, runStepClock, SUNWALL } from '@coldsurf/synth-kit'
import { createBass, DUB_HOLY_BASS } from '@coldsurf/synth-kit/bass'
import { createDrumKit, WET_KIT } from '@coldsurf/synth-kit/drumkit'
import {
  BLACK_STAGE,
  BLUE_STAGE,
  createGlStage,
  createVisualStage,
  createVisualSync,
  HATE_STAGE,
  type StagePreset,
  SUN_STAGE,
  type VisualStageHandle,
} from '@coldsurf/synth-kit/visual'

const BPM = 84
const STEP = 60 / BPM / 4
const BAR = 16
const LOOP = 64
const TOTAL = LOOP * 64

const CHORDS = [
  [220.0, 261.63, 329.63, 440.0], // Am
  [174.61, 220.0, 261.63, 349.23], // F
  [130.81, 164.81, 196.0, 261.63], // C
  [196.0, 246.94, 293.66, 392.0], // G
]
const SUB_ROOTS = [55.0, 43.65, 65.41, 49.0]

// Stage preset paired to the wall the track uses. SUNWALL → SUN_STAGE by default.
const STAGES: Record<string, StagePreset> = {
  SUN_STAGE,
  BLACK_STAGE,
  BLUE_STAGE,
  HATE_STAGE,
}

interface Backdrop {
  renderer: 'WebGL' | '2D'
  stop(): void
}

// Prefer the artistic WebGL renderer; fall back to the 2D canvas if WebGL2 is unavailable.
function makeStage(
  canvas: HTMLCanvasElement,
  analyser: AnalyserNode,
  stagePreset: StagePreset,
): { stage: VisualStageHandle; renderer: 'WebGL' | '2D' } {
  try {
    return { stage: createGlStage(canvas, analyser, stagePreset), renderer: 'WebGL' }
  } catch {
    return { stage: createVisualStage(canvas, analyser, stagePreset), renderer: '2D' }
  }
}

function startBackdrop(canvas: HTMLCanvasElement, stagePreset: StagePreset): Backdrop {
  const ctx = new AudioContext()

  const master = ctx.createGain()
  master.gain.value = 0.8
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -6
  limiter.ratio.value = 12
  limiter.attack.value = 0.003
  limiter.release.value = 0.25
  master.connect(limiter).connect(ctx.destination)

  // Tap the master for the visual — analyser is a dead-end (not connected onward),
  // so it reads the mix without affecting the sound.
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0.8
  master.connect(analyser)

  const { stage, renderer } = makeStage(canvas, analyser, stagePreset)
  const sync = createVisualSync(ctx, stage)

  const wallStrip = createStrip(ctx, master, {
    hpHz: 120,
    bell: { hz: 300, q: 1, gainDb: -2 },
    gain: 0.9,
  })
  const wall = createWall(ctx, wallStrip.input, SUNWALL, CHORDS[0])
  const kit = createDrumKit(ctx, master, WET_KIT)
  const bass = createBass(ctx, master, DUB_HOLY_BASS)

  const start = ctx.currentTime + 0.15
  wall.rampGain(0.7, 4)

  const clock = runStepClock(ctx, {
    start,
    step: STEP,
    totalSteps: TOTAL,
    onStep: (stepIdx, when) => {
      const p = stepIdx % LOOP
      const bar = Math.floor(p / BAR)
      const s = p % BAR

      if (s === 0) {
        wall.setChord(CHORDS[bar])
        sync.emit('chord', when, 1) // palette shifts on every chord change
      }
      if (s === 0 || s === 8) bass.sub(when, SUB_ROOTS[bar], STEP * 8, 0.7)

      if (stepIdx < 2 * BAR) return

      if (s === 0 || s === 8) {
        kit.kick(when, 0.85)
        sync.emit('kick', when, 0.9)
      }
      if (bar % 2 === 1 && s === 14) {
        kit.kick(when, 0.6)
        sync.emit('kick', when, 0.5)
      }
      if (s === 4 || s === 12) {
        kit.snare(when, 0.7)
        sync.emit('snare', when, 0.8)
      }
      if (s % 2 === 0 && s !== 14) kit.hat(when, 0.3, false)
      if (s === 14) {
        kit.hat(when, 0.35, true)
        sync.emit('accent', when, 0.7)
      }
    },
  })

  sync.start()

  let stopped = false
  return {
    renderer,
    stop() {
      if (stopped) return
      stopped = true
      clock.stop()
      sync.stop()
      wall.rampGain(0, 0.4)
      window.setTimeout(() => {
        wall.dispose()
        kit.dispose()
        bass.dispose()
        wallStrip.dispose()
        sync.dispose()
        stage.dispose()
        void ctx.close()
      }, 450)
    },
  }
}

export function mountVjSection(container: HTMLElement) {
  const controls = document.createElement('div')
  controls.className = 'controls'

  const select = document.createElement('select')
  for (const name of Object.keys(STAGES)) {
    const option = document.createElement('option')
    option.value = name
    option.textContent = name
    select.append(option)
  }

  const playButton = document.createElement('button')
  playButton.className = 'primary'
  playButton.textContent = '▶  Play the Backdrop'

  const fullscreenButton = document.createElement('button')
  fullscreenButton.textContent = '⛶ 풀스크린'

  const badge = document.createElement('span')
  badge.className = 'vj-badge'

  controls.append(select, playButton, fullscreenButton, badge)

  const stageEl = document.createElement('div')
  stageEl.className = 'vj-stage'
  const canvas = document.createElement('canvas')
  canvas.className = 'vj-canvas'
  stageEl.append(canvas)

  container.append(controls, stageEl)

  let backdrop: Backdrop | null = null

  const stop = () => {
    backdrop?.stop()
    backdrop = null
    playButton.textContent = '▶  Play the Backdrop'
    badge.textContent = ''
    stageEl.classList.remove('playing')
  }

  playButton.addEventListener('click', () => {
    if (backdrop) {
      stop()
    } else {
      backdrop = startBackdrop(canvas, STAGES[select.value])
      playButton.textContent = '■  Stop'
      badge.textContent = `renderer: ${backdrop.renderer}`
      stageEl.classList.add('playing')
    }
  })

  fullscreenButton.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void stageEl.requestFullscreen()
  })

  select.addEventListener('change', () => {
    if (backdrop) stop() // restart with the new stage on next play
  })
}
