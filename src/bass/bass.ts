/**
 * Bass — *저역* 합성 엔진. dub 트랙들이 글자 그대로 복제하던 sub·reese 베이스 골격을
 * 한 악기로. sunwall·drumkit 과 같은 VST 모델: `createBass` 는 *색-불문 엔진*,
 * `*_BASS` 는 *패치*.
 *
 *   sub   : sine + 보조 osc(triangle/같은·살짝 detune) → AD-sustain env → bus
 *   reese : detuned saw × 2(한 옥타브 위) → resonant lowpass → tanh saturation → bus
 *
 * 엔진은 *voice 합성* 만 한다 — `(when, freq, dur, velocity)` 절대시간으로 `bus` 에 한 음을
 * 그린다. 스케줄링(스텝 루프)·master fade·사이드체인 duck·dub send 는 *트랙* 의 책임이며
 * 엔진 밖이다 (drumkit 과 동일한 정규화 기준). dub-holy 처럼 sub 만 쓰는 트랙은 preset 에서
 * `reese` 를 비우면 `reese()` 가 no-op.
 *
 * 보존 기준: 들리는 envelope(attack·sustain·release)·필터·saturation·디튠은 원본 상수 그대로
 * preset 으로 주입. 들리지 않는 것만 정규화 — saturation 커브 Float32Array 는 핸들당 한 번
 * 계산해 음마다 재사용(내용 동일), ephemeral voice 노드의 지연 disconnect 는 drumkit 과 동일.
 *
 * 트랙 전용 저역(dig-it 의 motorik saw bass 등)은 rule-of-three 미달이라 트랙 인라인으로 남는다.
 */

/** sub 베이스 voice — sine + 보조 osc 의 sustained 저역 드론. */
export interface SubPreset {
  /** 보조 osc 파형. 세 트랙 'triangle'. */
  secondType: OscillatorType
  /** 보조 osc freq 배율 — *맥놀이* detune. relay·power 1, holy 1.005. 기본 1. */
  secondRatio?: number
  /** gain attack(0.0001 → velocity) 시간. relay 0.04 / power 0.05 / holy 0.08. */
  attack: number
  /** sustain 종료~exp decay 구간 길이. hold 는 `when + dur - release` 까지. relay 0.12 / power 0.15 / holy 0.2. */
  release: number
}

/** reese 베이스 voice — *우글거리는* mid-bass(detuned saw → resonant LP → tanh sat). */
export interface ReesePreset {
  /** root 대비 옥타브 배율. 세 트랙 2(한 옥타브 위). 기본 2. */
  octaveRatio?: number
  /** saw voice 디튠 ±cents. relay 8 / power 10. */
  detuneCents: number
  /** lowpass cutoff(Hz). relay 380 / power 420. */
  lpHz: number
  /** lowpass Q(resonance). relay 6 / power 5.5. */
  lpQ: number
  /** tanh saturation drive. relay 3.5 / power 3.2. */
  satK: number
  /** gain attack 시간. relay 0.012 / power 0.015. */
  attack: number
  /** sustain 종료~exp decay 구간 길이. relay 0.05 / power 0.06. */
  release: number
}

export interface BassPreset {
  sub?: SubPreset
  reese?: ReesePreset
}

export interface BassHandle {
  /** when 에 sub 한 음(dur 동안 sustain). preset.sub 없으면 no-op. */
  sub(when: number, freq: number, dur: number, velocity: number): void
  /** when 에 reese 한 음. preset.reese 없으면 no-op. */
  reese(when: number, freq: number, dur: number, velocity: number): void
  /** 공유 노드 정리. ephemeral voice 노드는 self-stop + 내부 타임아웃 disconnect. */
  dispose(): void
}

/** tanh saturation 커브 — reese 의 *우글거림*. drive 가 클수록 거칠다. */
function makeSaturationCurve(k: number): Float32Array<ArrayBuffer> {
  const n = 512
  const buffer = new ArrayBuffer(n * Float32Array.BYTES_PER_ELEMENT)
  const curve = new Float32Array(buffer)
  const denom = Math.tanh(k)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(k * x) / denom
  }
  return curve
}

/**
 * 베이스를 만들어 `bus` 로 voice 를 합성하는 핸들을 돌려준다.
 *
 * @param bus 각 음이 연결될 목적지(트랙의 ductable·master 등).
 */
export function createBass(ctx: AudioContext, bus: AudioNode, preset: BassPreset): BassHandle {
  // reese saturation 커브 — 핸들당 한 번. 음마다 새 WaveShaper 가 같은 Float32Array 를 공유.
  const reeseCurve = preset.reese ? makeSaturationCurve(preset.reese.satK) : null

  // ephemeral voice 노드의 지연 disconnect — drumkit 과 동일한 cleanup.
  let stopped = false
  const pending = new Set<() => void>()
  const trackDispose = (fn: () => void, lifetimeMs: number) => {
    pending.add(fn)
    window.setTimeout(() => {
      if (pending.has(fn)) {
        fn()
        pending.delete(fn)
      }
    }, lifetimeMs)
  }

  function sub(when: number, freq: number, dur: number, velocity: number) {
    if (stopped || !preset.sub) return
    const s = preset.sub

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const osc2 = ctx.createOscillator()
    osc2.type = s.secondType
    osc2.frequency.value = freq * (s.secondRatio ?? 1)

    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, when)
    g.gain.linearRampToValueAtTime(velocity, when + s.attack)
    g.gain.setValueAtTime(velocity, when + dur - s.release)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    osc.connect(g).connect(bus)
    osc2.connect(g)
    osc.start(when)
    osc2.start(when)
    const stop = dur + 0.05
    osc.stop(when + stop)
    osc2.stop(when + stop)
    trackDispose(
      () => {
        try {
          osc.stop()
          osc2.stop()
        } catch {
          // 이미 정지 — 무해.
        }
        osc.disconnect()
        osc2.disconnect()
        g.disconnect()
      },
      (stop + 0.1) * 1000,
    )
  }

  function reese(when: number, freq: number, dur: number, velocity: number) {
    if (stopped || !preset.reese || !reeseCurve) return
    const r = preset.reese

    const out = ctx.createGain()
    out.gain.setValueAtTime(0.0001, when)
    out.gain.linearRampToValueAtTime(velocity, when + r.attack)
    out.gain.setValueAtTime(velocity, when + dur - r.release)
    out.gain.exponentialRampToValueAtTime(0.0001, when + dur)

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = r.lpHz
    lp.Q.value = r.lpQ
    out.connect(lp)

    const sat = ctx.createWaveShaper()
    sat.curve = reeseCurve
    sat.oversample = '2x'
    lp.connect(sat).connect(bus)

    const octave = r.octaveRatio ?? 2
    const oscs: OscillatorNode[] = []
    const gains: GainNode[] = []
    const stop = dur + 0.05
    for (let v = 0; v < 2; v++) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      const cents = v === 0 ? -r.detuneCents : r.detuneCents
      osc.frequency.value = freq * octave * 2 ** (cents / 1200)
      const og = ctx.createGain()
      og.gain.value = 0.5
      osc.connect(og).connect(out)
      osc.start(when)
      osc.stop(when + stop)
      oscs.push(osc)
      gains.push(og)
    }
    trackDispose(
      () => {
        for (const osc of oscs) {
          try {
            osc.stop()
          } catch {
            // 이미 정지 — 무해.
          }
          osc.disconnect()
        }
        for (const og of gains) og.disconnect()
        out.disconnect()
        lp.disconnect()
        sat.disconnect()
      },
      (stop + 0.1) * 1000,
    )
  }

  return {
    sub,
    reese,
    dispose() {
      stopped = true
      for (const fn of pending) {
        try {
          fn()
        } catch {
          // 이미 정리됨 — 무해.
        }
      }
      pending.clear()
    },
  }
}
