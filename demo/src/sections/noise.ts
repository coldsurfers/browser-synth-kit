/**
 * "Noise" — a standalone, tunable masking-noise generator.
 *
 * No music, no engines: just *violet* noise (white noise differentiated → +6 dB/oct,
 * an airy high-freq hiss — the "Ten Hours of Violet Noise" bed) shaped by one
 * bandpass. Two knobs make it yours: the *pitch* (bandpass center) and the
 * *focus* (bandpass Q — broad airy wash ↔ tight hiss locked onto your pitch).
 * A tuning tone helps you match the band to a pitch (e.g. your tinnitus).
 *
 *   violet noise → bandpass(freq = pitch, Q = focus) → level → analyser → limiter → out
 *   tone(sine @ pitch) → toneGain → out   (independent pitch-finder)
 *
 * ⚠️ Educational demo, not a medical device. Keep the volume low.
 */

// --- pitch range: a log slider over the usual high-freq masking range ---------
const FT_MIN = 500
const FT_MAX = 12000
const DEFAULT_FT = 6000
const SLIDER_MAX = 1000

const sliderToHz = (v: number): number => FT_MIN * (FT_MAX / FT_MIN) ** (v / SLIDER_MAX)
const hzToSlider = (hz: number): number =>
  Math.round((SLIDER_MAX * Math.log(hz / FT_MIN)) / Math.log(FT_MAX / FT_MIN))
const fmtHz = (hz: number): string =>
  hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : `${Math.round(hz)} Hz`

// focus slider (0..SLIDER_MAX) → bandpass Q: broad wash → tight band on your pitch
const FOCUS_Q_MIN = 0.5
const FOCUS_Q_MAX = 16
const DEFAULT_FOCUS = 380
const focusToQ = (v: number): number =>
  FOCUS_Q_MIN * (FOCUS_Q_MAX / FOCUS_Q_MIN) ** (v / SLIDER_MAX)

// level slider (0..SLIDER_MAX) → gain, capped for hearing safety
const LEVEL_MAX = 0.25
const DEFAULT_LEVEL = 480
const levelToGain = (v: number): number => (v / SLIDER_MAX) * LEVEL_MAX

// master volume (0..SLIDER_MAX) → 0..1 gain over the whole section (noise + tone)
const DEFAULT_VOLUME = 700
const volumeToGain = (v: number): number => v / SLIDER_MAX

// --- violet noise buffer: 2s loop, deterministic ------------------------------
function makeVioletNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const data = buf.getChannelData(0)
  // deterministic PRNG — no Math.random needed, and identical every run
  let seed = 0x1a2b3c4d
  const white = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x40000000 - 1 // -1..1
  }
  // violet noise = first difference of white noise (differentiator = +6 dB/oct)
  let prev = 0
  let peak = 1e-6
  for (let i = 0; i < data.length; i++) {
    const w = white()
    data[i] = w - prev
    prev = w
    peak = Math.max(peak, Math.abs(data[i]))
  }
  const norm = 0.5 / peak // normalize so it loops at a safe, even level
  for (let i = 0; i < data.length; i++) data[i] *= norm
  return buf
}

// --- the running noise --------------------------------------------------------
interface NoiseHandle {
  setFt(hz: number): void
  setFocus(q: number): void
  setLevel(gain: number): void
  analyser: AnalyserNode
  stop(): void
}

function startNoise(
  ctx: AudioContext,
  dest: AudioNode,
  ft: number,
  q: number,
  level: number,
): NoiseHandle {
  const noise = ctx.createBufferSource()
  noise.buffer = makeVioletNoiseBuffer(ctx)
  noise.loop = true

  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = ft
  band.Q.value = q

  const gain = ctx.createGain()
  gain.gain.value = 0 // fade in

  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0.7

  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -6
  limiter.ratio.value = 12
  limiter.attack.value = 0.003
  limiter.release.value = 0.25

  noise.connect(band).connect(gain).connect(analyser)
  analyser.connect(limiter).connect(dest)
  noise.start()
  gain.gain.setTargetAtTime(level, ctx.currentTime, 0.3)

  const at = () => ctx.currentTime
  let stopped = false

  return {
    analyser,
    setFt(hz) {
      band.frequency.setTargetAtTime(hz, at(), 0.02)
    },
    setFocus(nextQ) {
      band.Q.setTargetAtTime(nextQ, at(), 0.05)
    },
    setLevel(nextGain) {
      gain.gain.setTargetAtTime(nextGain, at(), 0.1)
    },
    stop() {
      if (stopped) return
      stopped = true
      gain.gain.setTargetAtTime(0, at(), 0.2)
      window.setTimeout(() => {
        try {
          noise.stop()
        } catch {
          /* already stopped */
        }
        noise.disconnect()
        band.disconnect()
        gain.disconnect()
        analyser.disconnect()
        limiter.disconnect()
      }, 400)
    },
  }
}

// --- realtime spectrum: log-frequency bars + a marker line at your pitch -------
function drawSpectrum(
  canvas: HTMLCanvasElement,
  getAnalyser: () => AnalyserNode | null,
  getFt: () => number,
) {
  const cctx = canvas.getContext('2d')
  if (!cctx) return
  const F_LO = 100
  const F_HI = 16000

  const render = () => {
    requestAnimationFrame(render)
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
    }
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    cctx.clearRect(0, 0, w, h)

    const analyser = getAnalyser()
    const ft = getFt()
    const xOfHz = (hz: number) => (Math.log(hz / F_LO) / Math.log(F_HI / F_LO)) * w

    if (analyser) {
      const bins = analyser.frequencyBinCount
      const data = new Uint8Array(bins)
      analyser.getByteFrequencyData(data)
      const nyquist = analyser.context.sampleRate / 2
      cctx.fillStyle = '#6ee7ff'
      const step = 2
      for (let x = 0; x < w; x += step) {
        const hz = F_LO * (F_HI / F_LO) ** (x / w)
        const bin = Math.min(bins - 1, Math.round((hz / nyquist) * bins))
        const mag = data[bin] / 255
        const barH = mag * mag * h
        cctx.fillRect(x, h - barH, step, barH)
      }
    }

    const fx = xOfHz(ft)
    cctx.fillStyle = 'rgba(255,90,120,0.9)'
    cctx.fillRect(fx - 1, 0, 2, h)
    cctx.fillStyle = 'rgba(255,90,120,0.75)'
    cctx.font = '11px ui-monospace, Menlo, monospace'
    cctx.textAlign = fx > w - 60 ? 'right' : 'left'
    cctx.fillText(fmtHz(ft), fx > w - 60 ? fx - 5 : fx + 5, 14)
    cctx.textAlign = 'left'
  }
  render()
}

// --- mount --------------------------------------------------------------------
function makeSlider(className: string, value: number): HTMLInputElement {
  const el = document.createElement('input')
  el.type = 'range'
  el.min = '0'
  el.max = String(SLIDER_MAX)
  el.value = String(value)
  el.className = className
  return el
}

function makeRow(label: string, ...controls: HTMLElement[]): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'noise-row'
  const span = document.createElement('span')
  span.className = 'noise-step'
  span.textContent = label
  row.append(span, ...controls)
  return row
}

export function mountNoiseSection(container: HTMLElement) {
  const playButton = document.createElement('button')
  playButton.className = 'primary'
  playButton.textContent = '▶ Play'
  const toneButton = document.createElement('button')
  toneButton.textContent = '▶ 순음 듣기'

  const ftSlider = makeSlider('noise-slider', hzToSlider(DEFAULT_FT))
  const ftReadout = document.createElement('span')
  ftReadout.className = 'noise-readout'

  const focusSlider = makeSlider('noise-slider', DEFAULT_FOCUS)
  const focusReadout = document.createElement('span')
  focusReadout.className = 'noise-readout'

  const levelSlider = makeSlider('noise-slider', DEFAULT_LEVEL)
  const levelReadout = document.createElement('span')
  levelReadout.className = 'noise-readout'

  const volumeSlider = makeSlider('noise-slider', DEFAULT_VOLUME)
  const volumeReadout = document.createElement('span')
  volumeReadout.className = 'noise-readout'

  const canvas = document.createElement('canvas')
  canvas.className = 'noise-spectrum'

  const disclaimer = document.createElement('p')
  disclaimer.className = 'noise-disclaimer'
  disclaimer.innerHTML =
    '⚠️ 교육/데모용이며 의료기기가 아닙니다. <strong>볼륨을 낮게</strong> 시작하세요 — ' +
    '고주파 노이즈를 크게·오래 들으면 청력에 해로울 수 있습니다.'

  container.append(
    makeRow('재생', playButton, toneButton),
    makeRow('볼륨', volumeSlider, volumeReadout),
    makeRow('주파수', ftSlider, ftReadout),
    makeRow('노이즈 집중', focusSlider, focusReadout),
    makeRow('노이즈 레벨', levelSlider, levelReadout),
    canvas,
    disclaimer,
  )

  // --- state ---
  let ft = DEFAULT_FT
  let focusQ = focusToQ(DEFAULT_FOCUS)
  let level = levelToGain(DEFAULT_LEVEL)
  let volume = volumeToGain(DEFAULT_VOLUME)
  let noise: NoiseHandle | null = null
  let toneOsc: OscillatorNode | null = null
  let toneGain: GainNode | null = null
  let ctx: AudioContext | null = null
  let master: GainNode | null = null

  // master volume node — everything (noise + tone) routes through it → speakers
  const ensureCtx = (): AudioContext => {
    if (!ctx) {
      ctx = new AudioContext()
      master = ctx.createGain()
      master.gain.value = volume
      master.connect(ctx.destination)
    }
    return ctx
  }

  const sync = () => {
    ftReadout.textContent = fmtHz(ft)
    focusReadout.textContent = `Q ${focusQ.toFixed(1)}`
    levelReadout.textContent = `${Math.round((level / LEVEL_MAX) * 100)}%`
    volumeReadout.textContent = `${Math.round(volume * 100)}%`
  }
  sync()

  drawSpectrum(
    canvas,
    () => noise?.analyser ?? null,
    () => ft,
  )

  ftSlider.addEventListener('input', () => {
    ft = sliderToHz(Number(ftSlider.value))
    sync()
    noise?.setFt(ft)
    if (toneOsc) toneOsc.frequency.setTargetAtTime(ft, ensureCtx().currentTime, 0.02)
  })

  focusSlider.addEventListener('input', () => {
    focusQ = focusToQ(Number(focusSlider.value))
    sync()
    noise?.setFocus(focusQ)
  })

  levelSlider.addEventListener('input', () => {
    level = levelToGain(Number(levelSlider.value))
    sync()
    noise?.setLevel(level)
  })

  volumeSlider.addEventListener('input', () => {
    volume = volumeToGain(Number(volumeSlider.value))
    sync()
    master?.gain.setTargetAtTime(volume, ensureCtx().currentTime, 0.05)
  })

  playButton.addEventListener('click', () => {
    if (noise) {
      noise.stop()
      noise = null
      playButton.textContent = '▶ Play'
      container.classList.remove('playing')
      return
    }
    const c = ensureCtx()
    noise = startNoise(c, master ?? c.destination, ft, focusQ, level)
    playButton.textContent = '■ Stop'
    container.classList.add('playing')
  })

  // tuning tone to match a pitch (capped volume for safety)
  toneButton.addEventListener('click', () => {
    const c = ensureCtx()
    if (toneOsc) {
      toneGain?.gain.setTargetAtTime(0, c.currentTime, 0.02)
      const osc = toneOsc
      window.setTimeout(() => osc.stop(), 120)
      toneOsc = null
      toneGain = null
      toneButton.textContent = '▶ 순음 듣기'
      return
    }
    toneOsc = c.createOscillator()
    toneOsc.type = 'sine'
    toneOsc.frequency.value = ft
    toneGain = c.createGain()
    toneGain.gain.value = 0
    toneOsc.connect(toneGain).connect(master ?? c.destination)
    toneOsc.start()
    toneGain.gain.setTargetAtTime(0.06, c.currentTime, 0.03) // ≤ 0.06 hard cap
    toneButton.textContent = '■ 정지'
  })
}
