/**
 * Drumkit — *타악* 합성 엔진. catalog 트랙들이 글자 그대로 복제하던 kick·snare·hat 골격을
 * 한 악기로. sunwall 과 같은 VST 모델: `createDrumKit` 은 *색-불문 엔진*, `*_KIT` 은 *패치*.
 *
 *   kick   : body osc(피치 envelope) → gain env → bus  (+ 옵션 sub body, click transient)
 *   snare  : tone osc + bandpass noise (+ 옵션 gated reverb tail × N)
 *   hat    : highpass(+옵션 bandpass) noise → gain env (closed/open)
 *
 * 엔진은 *voice 합성* 만 한다 — `(when, velocity)` 절대시간으로 `bus` 에 한 타격을 그린다.
 * 스케줄링(스텝 루프)·master fade·사이드체인 duck·dub send 는 *트랙* 의 책임이며 엔진 밖이다.
 * 한 곡 전용 voice(metalHit·tom·shimmer·salute·
 * crash·clap·rim)는 rule-of-three 미달이라 트랙 인라인으로 남는다.
 *
 * 보존 기준: 들리는 envelope(attack·peak·decay)·필터·피치는 원본 상수 그대로. 들리지 않는
 * 것만 정규화 — ① white noise 버퍼 내용(통계적으로 동일한 난수), ② 일부 노드 stop() 시점은
 * preset 의 `stop`/`stopPad` 로 그대로 박는다.
 */

/** envelope ramp 종류. dub kick 은 exp attack(peak>velocity 허용), 그 외엔 lin. */
type Ramp = 'lin' | 'exp'

/** 피치 + gain envelope 한 layer (kick body·sub 공용). */
export interface KickBody {
  startHz: number
  endHz: number
  /** freq exponentialRamp 도달 시간. */
  pitchTau: number
  /** gain attack 시간. */
  attack: number
  attackCurve: Ramp
  /** peak gain = velocity * peakMul. 기본 1. dub body1 은 1.3 등. */
  peakMul?: number
  /** gain exponentialRamp→0 도달 시간(=감쇠 끝). */
  decay: number
  /** osc.stop(when + stop). */
  stop: number
}

/** kick transient click — 짧은 highpass noise burst. */
export interface KickClick {
  hpHz: number
  /** peak = velocity * level. */
  level: number
  attack: number
  attackCurve: Ramp
  decay: number
  stop: number
}

export interface KickPreset {
  body: KickBody
  /** dub 전용 — 깊은 sub tail layer. */
  sub?: KickBody
  click?: KickClick
}

export interface SnareTone {
  type: OscillatorType
  startHz: number
  /** 있으면 startHz → endHz 피치 envelope. */
  endHz?: number
  pitchTau?: number
  /** peak = velocity * level. */
  level: number
  decay: number
  stop: number
}

export interface SnareNoise {
  bpHz: number
  q: number
  /** playbackRate ∈ [prMin, prMax] 무작위. 고정이면 두 값 동일. */
  prMin: number
  prMax: number
  level: number
  decay: number
  stop: number
}

/** Gated reverb tail (wet-room 의 *In the Air Tonight* 결). 자연 감쇠 대신 plateau → cut. */
export interface GatedTail {
  centerHz: number
  q: number
  /** peak = velocity * level. */
  level: number
  plateau: number
  cut: number
}

export interface SnarePreset {
  tone?: SnareTone
  noise?: SnareNoise
  gatedTails?: GatedTail[]
}

export interface HatPreset {
  hpHz: number
  hpQ?: number
  /** 있으면 highpass 뒤에 bandpass 한 단(dub hat). */
  bpHz?: number
  bpQ?: number
  /** playbackRate = prCenter + (random - 0.5) * prSpread. */
  prCenter: number
  prSpread: number
  attack: number
  closedDecay: number
  openDecay: number
  /** peak = velocity * (open ? openLevel : closedLevel). dry/iron/reveal 은 1. */
  closedLevel: number
  openLevel: number
  /** stop = when + tail + stopPad. */
  stopPad: number
}

export interface DrumKitPreset {
  kick: KickPreset
  snare?: SnarePreset
  hat?: HatPreset
}

export interface DrumKitHandle {
  /** when 에 kick 한 타. */
  kick(when: number, velocity: number): void
  /** when 에 snare 한 타. preset.snare 없으면 no-op. */
  snare(when: number, velocity: number): void
  /** when 에 hat 한 타(open/closed). preset.hat 없으면 no-op. */
  hat(when: number, velocity: number, open: boolean): void
  /** 공유 노드 정리. ephemeral voice 노드는 self-stop + 내부 타임아웃 disconnect. */
  dispose(): void
}

/** attack ramp 한 줄 — 0.0001 에서 peak 까지 lin/exp. */
function attackTo(param: AudioParam, peak: number, when: number, attack: number, curve: Ramp) {
  param.setValueAtTime(0.0001, when)
  if (curve === 'exp') param.exponentialRampToValueAtTime(peak, when + attack)
  else param.linearRampToValueAtTime(peak, when + attack)
}

/**
 * 드럼킷을 만들어 `bus` 로 voice 를 합성하는 핸들을 돌려준다.
 *
 * @param bus 각 타격이 연결될 목적지(트랙의 drumBus·tone·master 등).
 */
export function createDrumKit(
  ctx: AudioContext,
  bus: AudioNode,
  preset: DrumKitPreset,
): DrumKitHandle {
  // 공유 white noise 버퍼 — snare·hat 의 재료. 1s 면 모든 kit voice tail 을 덮는다.
  // 내용은 난수라 트랙별 원본과 *통계적으로 동일*(perceptually identical).
  const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.0), ctx.sampleRate)
  {
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }

  // ephemeral voice 노드의 지연 disconnect — 기존 trackDispose 동작을 엔진 내부로 흡수.
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

  function playBody(b: KickBody, when: number, velocity: number) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(b.startHz, when)
    osc.frequency.exponentialRampToValueAtTime(b.endHz, when + b.pitchTau)
    const g = ctx.createGain()
    attackTo(g.gain, velocity * (b.peakMul ?? 1), when, b.attack, b.attackCurve)
    g.gain.exponentialRampToValueAtTime(0.0001, when + b.decay)
    osc.connect(g).connect(bus)
    osc.start(when)
    osc.stop(when + b.stop)
    trackDispose(
      () => {
        try {
          osc.stop()
        } catch {
          // 이미 정지 — 무해.
        }
        osc.disconnect()
        g.disconnect()
      },
      (b.stop + 0.1) * 1000,
    )
  }

  function kick(when: number, velocity: number) {
    if (stopped) return
    const k = preset.kick
    playBody(k.body, when, velocity)
    if (k.sub) playBody(k.sub, when, velocity)
    if (k.click) {
      const c = k.click
      const src = ctx.createBufferSource()
      src.buffer = noiseBuf
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = c.hpHz
      const g = ctx.createGain()
      attackTo(g.gain, velocity * c.level, when, c.attack, c.attackCurve)
      g.gain.exponentialRampToValueAtTime(0.0001, when + c.decay)
      src.connect(hp).connect(g).connect(bus)
      src.start(when)
      src.stop(when + c.stop)
      trackDispose(
        () => {
          try {
            src.stop()
          } catch {
            // 이미 정지 — 무해.
          }
          src.disconnect()
          hp.disconnect()
          g.disconnect()
        },
        (c.stop + 0.1) * 1000,
      )
    }
  }

  function snare(when: number, velocity: number) {
    if (stopped || !preset.snare) return
    const s = preset.snare

    if (s.tone) {
      const t = s.tone
      const osc = ctx.createOscillator()
      osc.type = t.type
      osc.frequency.setValueAtTime(t.startHz, when)
      if (t.endHz !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(t.endHz, when + (t.pitchTau ?? 0.08))
      }
      const g = ctx.createGain()
      attackTo(g.gain, velocity * t.level, when, 0.003, 'lin')
      g.gain.exponentialRampToValueAtTime(0.0001, when + t.decay)
      osc.connect(g).connect(bus)
      osc.start(when)
      osc.stop(when + t.stop)
      trackDispose(
        () => {
          try {
            osc.stop()
          } catch {
            // 이미 정지 — 무해.
          }
          osc.disconnect()
          g.disconnect()
        },
        (t.stop + 0.1) * 1000,
      )
    }

    if (s.noise) {
      const n = s.noise
      const src = ctx.createBufferSource()
      src.buffer = noiseBuf
      src.playbackRate.value = n.prMin + Math.random() * (n.prMax - n.prMin)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = n.bpHz
      bp.Q.value = n.q
      const g = ctx.createGain()
      attackTo(g.gain, velocity * n.level, when, 0.002, 'lin')
      g.gain.exponentialRampToValueAtTime(0.0001, when + n.decay)
      src.connect(bp).connect(g).connect(bus)
      src.start(when)
      src.stop(when + n.stop)
      trackDispose(
        () => {
          try {
            src.stop()
          } catch {
            // 이미 정지 — 무해.
          }
          src.disconnect()
          bp.disconnect()
          g.disconnect()
        },
        (n.stop + 0.1) * 1000,
      )
    }

    if (s.gatedTails) {
      for (const tl of s.gatedTails) {
        const src = ctx.createBufferSource()
        src.buffer = noiseBuf
        src.playbackRate.value = 0.7 + Math.random() * 0.2
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = tl.centerHz
        bp.Q.value = tl.q
        const g = ctx.createGain()
        const peak = velocity * tl.level
        // attack → plateau → 갑자기 cut (자연 감쇠가 아닌 *gated*).
        g.gain.setValueAtTime(0.0001, when)
        g.gain.linearRampToValueAtTime(peak, when + 0.006)
        g.gain.setValueAtTime(peak * 0.85, when + tl.plateau)
        g.gain.linearRampToValueAtTime(0.0001, when + tl.plateau + tl.cut)
        src.connect(bp).connect(g).connect(bus)
        src.start(when)
        const stop = tl.plateau + tl.cut + 0.05
        src.stop(when + stop)
        trackDispose(
          () => {
            try {
              src.stop()
            } catch {
              // 이미 정지 — 무해.
            }
            src.disconnect()
            bp.disconnect()
            g.disconnect()
          },
          (stop + 0.1) * 1000,
        )
      }
    }
  }

  function hat(when: number, velocity: number, open: boolean) {
    if (stopped || !preset.hat) return
    const h = preset.hat
    const src = ctx.createBufferSource()
    src.buffer = noiseBuf
    src.playbackRate.value = h.prCenter + (Math.random() - 0.5) * h.prSpread
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = h.hpHz
    if (h.hpQ !== undefined) hp.Q.value = h.hpQ

    let tail: AudioNode = hp
    let bp: BiquadFilterNode | null = null
    if (h.bpHz !== undefined) {
      bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = h.bpHz
      if (h.bpQ !== undefined) bp.Q.value = h.bpQ
      hp.connect(bp)
      tail = bp
    }

    const decay = open ? h.openDecay : h.closedDecay
    const peak = velocity * (open ? h.openLevel : h.closedLevel)
    const g = ctx.createGain()
    attackTo(g.gain, peak, when, h.attack, 'lin')
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay)
    src.connect(hp)
    tail.connect(g).connect(bus)
    src.start(when)
    const stop = decay + h.stopPad
    src.stop(when + stop)
    trackDispose(
      () => {
        try {
          src.stop()
        } catch {
          // 이미 정지 — 무해.
        }
        src.disconnect()
        hp.disconnect()
        bp?.disconnect()
        g.disconnect()
      },
      (stop + 0.1) * 1000,
    )
  }

  return {
    kick,
    snare,
    hat,
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
