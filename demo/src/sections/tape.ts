/**
 * "Play the Tape" — the hero. One generative track that wires *every* engine
 * together: wall + drumkit + bass + space(strip) + scheduler. Zero samples.
 *
 * This is the marketing: hit play, hear a finished shoegaze/wall track come out
 * of pure Web Audio, then open "show the code" to see the ~40 lines that made it.
 */
import { createStrip, createWall, runStepClock, SUNWALL } from '@coldsurf/synth-kit'
import { createBass, DUB_HOLY_BASS } from '@coldsurf/synth-kit/bass'
import { createDrumKit, WET_KIT } from '@coldsurf/synth-kit/drumkit'

const BPM = 84
const STEP = 60 / BPM / 4 // 16th notes
const BAR = 16 // steps per bar
const LOOP = 64 // 4-bar pattern
const TOTAL = LOOP * 64 // long enough to feel endless; loops via stepIdx % LOOP

// Chord progression Am → F → C → G (i-VI-III-VII) — the wall's 4 tones per bar
// (root · 3rd · 5th · octave), as frequencies in Hz.
const CHORDS = [
  [220.0, 261.63, 329.63, 440.0], // Am
  [174.61, 220.0, 261.63, 349.23], // F
  [130.81, 164.81, 196.0, 261.63], // C
  [196.0, 246.94, 293.66, 392.0], // G
]
// Deep sub root under each bar's chord.
const SUB_ROOTS = [55.0, 43.65, 65.41, 49.0] // A1 · F1 · C2 · G1

interface Tape {
  stop(): void
}

function startTape(): Tape {
  const ctx = new AudioContext()

  // master → limiter → speakers. The limiter is a consumer-side safety net so
  // the stacked engines never clip harshly across browsers.
  const master = ctx.createGain()
  master.gain.value = 0.8
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -6
  limiter.ratio.value = 12
  limiter.attack.value = 0.003
  limiter.release.value = 0.25
  master.connect(limiter).connect(ctx.destination)

  // §7 mix discipline: pan/carve only the *sustained* wall (through a strip);
  // route *transient* drums straight to the mono master.
  const wallStrip = createStrip(ctx, master, {
    hpHz: 120, // leave the low end to the sub
    bell: { hz: 300, q: 1, gainDb: -2 }, // scoop mud where wall + bass collide
    gain: 0.9,
  })
  const wall = createWall(ctx, wallStrip.input, SUNWALL, CHORDS[0])
  const kit = createDrumKit(ctx, master, WET_KIT)
  const bass = createBass(ctx, master, DUB_HOLY_BASS)

  const start = ctx.currentTime + 0.15
  wall.rampGain(0.7, 4) // fade the wall in once, over 4s

  const clock = runStepClock(ctx, {
    start,
    step: STEP,
    totalSteps: TOTAL,
    onStep: (stepIdx, when) => {
      const p = stepIdx % LOOP
      const bar = Math.floor(p / BAR)
      const s = p % BAR

      if (s === 0) wall.setChord(CHORDS[bar]) // glide to the bar's chord
      if (s === 0 || s === 8) bass.sub(when, SUB_ROOTS[bar], STEP * 8, 0.7)

      if (stepIdx < 2 * BAR) return // 2-bar intro: wall + sub only

      if (s === 0 || s === 8) kit.kick(when, 0.85)
      if (bar % 2 === 1 && s === 14) kit.kick(when, 0.6) // syncopated pickup
      if (s === 4 || s === 12) kit.snare(when, 0.7) // WET_KIT gated tail
      if (s % 2 === 0 && s !== 14) kit.hat(when, 0.3, false)
      if (s === 14) kit.hat(when, 0.35, true)
    },
  })

  let stopped = false
  return {
    stop() {
      if (stopped) return
      stopped = true
      clock.stop()
      wall.rampGain(0, 0.4)
      window.setTimeout(() => {
        wall.dispose()
        kit.dispose()
        bass.dispose()
        wallStrip.dispose()
        void ctx.close()
      }, 450)
    },
  }
}

const CODE = `import { createWall, createStrip, runStepClock, SUNWALL } from '@coldsurf/synth-kit'
import { createBass, DUB_HOLY_BASS } from '@coldsurf/synth-kit/bass'
import { createDrumKit, WET_KIT } from '@coldsurf/synth-kit/drumkit'

// wire every engine into one master — pan/carve the sustained wall, keep drums mono
const wallStrip = createStrip(ctx, master, { hpHz: 120, bell: { hz: 300, q: 1, gainDb: -2 } })
const wall = createWall(ctx, wallStrip.input, SUNWALL, CHORDS[0])
const kit  = createDrumKit(ctx, master, WET_KIT)
const bass = createBass(ctx, master, DUB_HOLY_BASS)

wall.rampGain(0.7, 4) // fade the wall in

// the caller owns scheduling — the scheduler is color-blind
runStepClock(ctx, { start, step: 60 / 84 / 4, totalSteps, onStep: (i, when) => {
  const bar = Math.floor((i % 64) / 16), s = i % 16
  if (s === 0) wall.setChord(CHORDS[bar])
  if (s === 0 || s === 8) bass.sub(when, SUB_ROOTS[bar], step * 8, 0.7)
  if (s === 0 || s === 8) kit.kick(when, 0.85)
  if (s === 4 || s === 12) kit.snare(when, 0.7)
  if (s % 2 === 0) kit.hat(when, 0.3, s === 14)
}})`

export function mountTapeSection(container: HTMLElement) {
  const button = document.createElement('button')
  button.className = 'primary tape-play'
  button.textContent = '▶  Play the Tape'

  const meta = document.createElement('p')
  meta.className = 'tape-meta'
  meta.textContent = 'wall + drumkit + bass + space + scheduler · 84 BPM · zero samples'

  const toggle = document.createElement('button')
  toggle.className = 'tape-code-toggle'
  toggle.textContent = '▸ show the code that made it'

  const code = document.createElement('pre')
  code.className = 'tape-code'
  code.hidden = true
  code.textContent = CODE

  container.append(button, meta, toggle, code)

  let tape: Tape | null = null
  button.addEventListener('click', () => {
    if (tape) {
      tape.stop()
      tape = null
      button.textContent = '▶  Play the Tape'
      container.classList.remove('playing')
    } else {
      tape = startTape()
      button.textContent = '■  Stop'
      container.classList.add('playing')
    }
  })

  toggle.addEventListener('click', () => {
    const open = code.hidden
    code.hidden = !open
    toggle.textContent = open ? '▾ hide the code' : '▸ show the code that made it'
  })
}
