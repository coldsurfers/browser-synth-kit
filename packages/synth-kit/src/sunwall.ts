/**
 * Sunwall — *블랙게이즈 벽* 신스 엔진. COLDSURF SOUND 의 *벽* 어휘를 한 악기로.
 *
 * VST 모델: `createWall` 은 *색-불문 엔진*, `SUNWALL`·`SUBLIME_HATE_WALL`·`GRATIS_WALL`
 * 은 *패치(preset)*. Batheday(11) 의 합성 골격을 그대로 떼어낸 것 —
 *
 *   sawtooth 5 voice × 4 화음 톤
 *     → (per-voice pitch-bend LFO, 옵션)
 *     → WaveShaper(distortion curve)
 *     → HP / LP 톤 다듬기
 *     → tremolo LFO (sawtooth, gain 변조)
 *     → 트랙 master bus
 *
 * 시간에 따라 움직이는 값(디스토션 amount ramp·트레몰로 depth·pitch-bend depth·화음)은
 * *트랙 시퀀서* 가 핸들 메서드로 구동한다. 엔진은 *정적 골격* 만 만든다. 소리 보존이 기준이라
 * 트랙별 미세 상수(glide τ·LP cutoff·trem base)는 preset 으로 *그대로* 주입된다.
 *
 * 드럼·crash·pluck·pad 는 본 엔진 밖 — 트랙 인라인 (드럼은 후속 카드에서 별도 분리 예정).
 */

/** 디스토션 커브 — *벽* 톤. amount 가 클수록 거칠다. 세 트랙 공통 커브. */
export function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 4096
  const buffer = new ArrayBuffer(n * Float32Array.BYTES_PER_ELEMENT)
  const curve = new Float32Array(buffer)
  const deg = Math.PI / 180
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x))
  }
  return curve
}

/** 트레몰로 LFO 설정. */
export interface WallTrem {
  /** LFO 파형. 세 트랙 'sawtooth'. */
  type: OscillatorType
  /** LFO rate (Hz). 세 트랙 13. */
  hz: number
  /** tremGain 의 base gain. batheday 0.62 / sublime·gratis 1.0. */
  baseGain: number
  /** tremDepth 초기값. batheday -0.42(정적) / sublime·gratis 0(시퀀서가 ramp). */
  initialDepth: number
}

/** per-voice pitch-bend LFO (슈게이즈/블랙게이즈 계열의 *흔들리는 톤*). 없으면 bend 미생성. */
export interface WallBend {
  /** LFO rate 하한 (Hz). */
  hzMin: number
  /** LFO rate 상한 (Hz). voice 마다 [hzMin, hzMax] 에서 무작위 — *동기 없는* wobble. */
  hzMax: number
}

/** 엔진 골격 preset — 색-불문 정적 파라미터. 화음(initialTones)은 런타임 주입. */
export interface WallPreset {
  /** voice 디튠 cents. 기본 [-12,-5,0,5,12]. */
  detunes?: number[]
  /** 각 voice osc → wallBus 사이 gain. 세 트랙 0.05. */
  voiceGain?: number
  /** WaveShaper 전 부스트. 세 트랙 1.4. */
  preGain?: number
  /** 디스토션 후 HP. 세 트랙 110. */
  hpHz?: number
  /** 디스토션 후 LP. batheday 3800 / sublime·gratis 4200. */
  lpHz?: number
  /** LP Q. 세 트랙 0.6. */
  lpQ?: number
  /** setChord glide 시간상수. batheday 0.08 / sublime 0.12 / gratis 0.14. */
  glideTau?: number
  /** WaveShaper 초기 amount. batheday 45(정적) / sublime·gratis 0. */
  initialDistortion: number
  trem: WallTrem
  /** 있으면 voice 마다 pitch-bend LFO 생성. */
  bend?: WallBend
}

export interface WallHandle {
  /** 4 화음 톤(루트·3·5·옥타브) 으로 모든 voice glide. 색/모드는 트랙이 결정. */
  setChord(tones: number[]): void
  /** WaveShaper amount 갱신 (curve 재할당). 0.5 미만 변화는 무시 — 잦은 재할당 방지. */
  setDistortion(amount: number): void
  /** tremDepth 를 value 로 ramp (현재값 → value, rampSec). */
  setTremDepth(value: number, rampSec: number): void
  /** per-voice pitch-bend depth 를 ±cents 로 ramp. bend 없으면 no-op. */
  setBendDepth(cents: number, rampSec: number): void
  /** wallBus gain 을 target 으로 linear ramp (페이드 인/아웃 공용). */
  rampGain(target: number, rampSec: number): void
  /** 모든 oscillator 정지 (idempotent). 트랙 autoStop 용. */
  stop(): void
  /** stop + 전체 노드 disconnect. 트랙 cleanup 용. */
  dispose(): void
}

interface WallVoice {
  osc: OscillatorNode
  gain: GainNode
  baseToneIdx: number
  detuneCents: number
  bendLfo: OscillatorNode | null
  bendDepth: GainNode | null
}

const DEFAULT_DETUNES = [-12, -5, 0, 5, 12]

/**
 * 벽 신스를 만들어 `bus` 에 연결하고 핸들을 돌려준다.
 *
 * @param initialTones 시작 화음의 4 톤(루트·3·5·옥타브). 트랙의 chordProg[0].tones.
 */
export function createWall(
  ctx: AudioContext,
  bus: AudioNode,
  preset: WallPreset,
  initialTones: number[],
): WallHandle {
  const detunes = preset.detunes ?? DEFAULT_DETUNES
  const voiceGain = preset.voiceGain ?? 0.05
  const preGain = preset.preGain ?? 1.4
  const hpHz = preset.hpHz ?? 110
  const lpHz = preset.lpHz ?? 4200
  const lpQ = preset.lpQ ?? 0.6
  const glideTau = preset.glideTau ?? 0.12

  // 현재 화음 톤 — setBendDepth 가 voice 의 base freq 를 알아야 ±cents 가 정확.
  let currentTones = initialTones.slice()

  const wallBus = ctx.createGain()
  wallBus.gain.value = 0.0001 // 트랙 시퀀서가 페이드인.

  const wallShaper = ctx.createWaveShaper()
  wallShaper.curve = makeDistortionCurve(preset.initialDistortion)
  wallShaper.oversample = '2x'

  const wallPre = ctx.createGain()
  wallPre.gain.value = preGain

  const wallHp = ctx.createBiquadFilter()
  wallHp.type = 'highpass'
  wallHp.frequency.value = hpHz
  const wallLp = ctx.createBiquadFilter()
  wallLp.type = 'lowpass'
  wallLp.frequency.value = lpHz
  wallLp.Q.value = lpQ

  const tremGain = ctx.createGain()
  tremGain.gain.value = preset.trem.baseGain
  const tremLfo = ctx.createOscillator()
  tremLfo.type = preset.trem.type
  tremLfo.frequency.value = preset.trem.hz
  const tremDepth = ctx.createGain()
  tremDepth.gain.value = preset.trem.initialDepth
  tremLfo.connect(tremDepth).connect(tremGain.gain)
  tremLfo.start()

  wallBus
    .connect(wallPre)
    .connect(wallShaper)
    .connect(wallHp)
    .connect(wallLp)
    .connect(tremGain)
    .connect(bus)

  const voices: WallVoice[] = []
  for (let toneIdx = 0; toneIdx < 4; toneIdx++) {
    for (const cents of detunes) {
      const baseFreq = initialTones[toneIdx] * 2 ** (cents / 1200)
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = baseFreq

      let bendLfo: OscillatorNode | null = null
      let bendDepth: GainNode | null = null
      if (preset.bend) {
        bendLfo = ctx.createOscillator()
        bendLfo.type = 'sine'
        bendLfo.frequency.value =
          preset.bend.hzMin + Math.random() * (preset.bend.hzMax - preset.bend.hzMin)
        bendDepth = ctx.createGain()
        bendDepth.gain.value = 0 // 트랙 시퀀서가 ramp.
        bendLfo.connect(bendDepth).connect(osc.frequency)
        bendLfo.start()
      }

      const gain = ctx.createGain()
      gain.gain.value = voiceGain
      osc.connect(gain).connect(wallBus)
      osc.start()
      voices.push({ osc, gain, baseToneIdx: toneIdx, detuneCents: cents, bendLfo, bendDepth })
    }
  }

  let lastAmount = preset.initialDistortion

  return {
    setChord(tones: number[]) {
      currentTones = tones.slice()
      const t = ctx.currentTime
      for (const v of voices) {
        const target = tones[v.baseToneIdx] * 2 ** (v.detuneCents / 1200)
        v.osc.frequency.cancelScheduledValues(t)
        v.osc.frequency.setTargetAtTime(target, t, glideTau)
      }
    },

    setDistortion(amount: number) {
      if (Math.abs(amount - lastAmount) < 0.5) return
      lastAmount = amount
      wallShaper.curve = makeDistortionCurve(amount)
    },

    setTremDepth(value: number, rampSec: number) {
      const t = ctx.currentTime
      tremDepth.gain.cancelScheduledValues(t)
      tremDepth.gain.setValueAtTime(tremDepth.gain.value, t)
      tremDepth.gain.linearRampToValueAtTime(value, t + rampSec)
    },

    setBendDepth(cents: number, rampSec: number) {
      const t = ctx.currentTime
      for (const v of voices) {
        if (!v.bendDepth) continue
        const base = currentTones[v.baseToneIdx]
        const target = base * (cents / 1200)
        v.bendDepth.gain.cancelScheduledValues(t)
        v.bendDepth.gain.setTargetAtTime(target, t, rampSec)
      }
    },

    rampGain(target: number, rampSec: number) {
      const t = ctx.currentTime
      wallBus.gain.cancelScheduledValues(t)
      wallBus.gain.setValueAtTime(wallBus.gain.value, t)
      wallBus.gain.linearRampToValueAtTime(target, t + rampSec)
    },

    stop() {
      try {
        tremLfo.stop()
      } catch {
        // 이미 정지 — 무해.
      }
      for (const v of voices) {
        try {
          v.osc.stop()
          v.bendLfo?.stop()
        } catch {
          // 이미 정지 — 무해.
        }
      }
    },

    dispose() {
      this.stop()
      for (const v of voices) {
        v.osc.disconnect()
        v.gain.disconnect()
        v.bendLfo?.disconnect()
        v.bendDepth?.disconnect()
      }
      tremLfo.disconnect()
      tremDepth.disconnect()
      tremGain.disconnect()
      wallBus.disconnect()
      wallPre.disconnect()
      wallShaper.disconnect()
      wallHp.disconnect()
      wallLp.disconnect()
    },
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Presets — 색 패치. 정적 골격만; 시간 변주는 트랙 시퀀서가 핸들로 구동.
// ──────────────────────────────────────────────────────────────────────────────

/** Batheday(11) — *햇볕의 벽*. 블랙게이즈 계열 결. 정적 디스토션 45, bend 없음. */
export const SUNWALL: WallPreset = {
  lpHz: 3800,
  glideTau: 0.08,
  initialDistortion: 45,
  trem: { type: 'sawtooth', hz: 13, baseGain: 0.62, initialDepth: -0.42 },
}

/** Sublime / Hate(12) — *두 얼굴의 벽*. 디스토션 0 → 60 ramp, bend 0.5–0.9 Hz. */
export const SUBLIME_HATE_WALL: WallPreset = {
  lpHz: 4200,
  glideTau: 0.12,
  initialDistortion: 0,
  trem: { type: 'sawtooth', hz: 13, baseGain: 1.0, initialDepth: 0 },
  bend: { hzMin: 0.5, hzMax: 0.9 },
}

/** Gratis(13) — *(ㄲ)거저의 벽*. 디스토션 0 → 60 → 0 왕복, bend 0.5–0.9 Hz. */
export const GRATIS_WALL: WallPreset = {
  lpHz: 4200,
  glideTau: 0.14,
  initialDistortion: 0,
  trem: { type: 'sawtooth', hz: 13, baseGain: 1.0, initialDepth: 0 },
  bend: { hzMin: 0.5, hzMax: 0.9 },
}

/**
 * Blue Wall(17) — *흔들리는 벽*. 슈게이즈 계열의 *디튠 글라이드*.
 *
 * 다른 패치와 결이 다른 자리: 디스토션이 *덜 거칠고*(정적 25), tremolo 가 *픽 어택*(톱니 13Hz)
 * 이 아니라 *몸 전체가 호흡하는* sine 5 Hz·얕은 depth, 그리고 더 느린 bend(0.4–0.8 Hz) 가 코드
 * 톤 자체를 흔든다 — *합성으로 옮긴 pitch-bend bar*. bend depth 는 트랙 시퀀서가 ±15 cents 로
 * ramp 해 *벽 자체* 를 곡의 주인공으로 세운다(synth-forward).
 */
export const BLUEWALL: WallPreset = {
  lpHz: 4200,
  glideTau: 0.12,
  initialDistortion: 25,
  trem: { type: 'sine', hz: 5, baseGain: 0.7, initialDepth: -0.18 },
  bend: { hzMin: 0.4, hzMax: 0.8 },
}

/**
 * White Wall(18) — *디스토션 없는 벽*. post-rock 계열의 *클린 swell wall*.
 *
 * 본 패치의 시험: 디스토션이 *0* 일 때도 합성 골격이 *벽* 으로 들리는가. 답은 *질량을 옮긴다* —
 * 디스토션이 만들던 두께를 *voice 수* (5 → 8 디튠 × 4 화음 = 32 oscillator) 와 *넓은 디튠*
 * (±18 cents) 로 보충한다. initialDistortion 0 의 커브는 거의 선형(x/3)이라 *harmonic* 을 더하지
 * 않고 레벨만 다듬는다 — *클린* 한 saw 벽. tremolo 는 *어택 픽* (톱니 13Hz) 도 *호흡* (sine 5Hz)
 * 도 아닌 *가장 느린* triangle 0.3Hz — 벽 전체가 *밀물처럼* 차오르고 빠진다. bend 없음(움직임은
 * 디튠 자체로). *해가 진 후의 흰 벽* — 본 카탈로그 최초의 밝은 색.
 */
export const WHITEWALL: WallPreset = {
  detunes: [-18, -11, -5, -2, 2, 5, 11, 18], // 8 voice — 디스토션이 빠진 질량을 voice 수로 보충.
  voiceGain: 0.032, // 32 voice 합산 — 클리핑 회피로 voice 당 낮춤 (≈ 20 voice × 0.05 등가).
  lpHz: 5200, // 디스토션이 없어 고역이 거칠지 않다 — 더 열어 *공기* 를 남긴다.
  glideTau: 0.2, // 가장 느린 글라이드 — 화음이 *번지며* 바뀐다.
  initialDistortion: 0,
  trem: { type: 'triangle', hz: 0.3, baseGain: 0.85, initialDepth: -0.22 },
}

/**
 * Black Wall(19) — *짓누르는 벽*. post-metal 계열의 *sludge wall*.
 *
 * [[WHITEWALL]] 이 디스토션을 *0* 으로 잠가 *정적(靜寂) 극* 을 시험했다면, 본 패치는 반대 끝 —
 * 디스토션을 *세 트랙 중 가장 거칠게*(0 → 72 크레셴도) 밀어 *바디 극* 을 [[SUNWALL]](정적 45)
 * 너머로 끌고 간다. 색의 무게는 *세 상수* 가 옮긴다: ① 가장 어두운 LP(3000 — White 5200·Blue
 * 4200 보다 한참 닫힘)로 고역을 깎아 *검은* 톤, ② 가장 낮은 HP(80 — 저역을 더 남겨 *sub 까지
 * 닿는 무게*), ③ *타이트한* 디튠(±10)으로 voice 를 흩지 않고 한 덩어리로 *뭉친다*. tremolo 는
 * Batheday 의 톱니 13Hz *어택 픽* 도, White 의 triangle 0.3Hz *밀물* 도 아닌 *느린* sine 3Hz —
 * 거대한 화음이 무게를 못 이겨 천천히 *heave* 하는 결. depth 는 시퀀서가 ramp(0 → -0.3).
 * bend 없음 — 움직임은 *디스토션 크레셴도* 와 *sub 펄스* 가 만든다. *해도 달도 없는 검은 벽*.
 */
export const BLACKWALL: WallPreset = {
  detunes: [-10, -4, 0, 4, 10], // 타이트한 stack — sludge 의 *뭉친* 두께 (흩지 않는다).
  voiceGain: 0.046, // 디스토션이 가장 두꺼워 클리핑 회피로 voice 당 낮춤.
  hpHz: 80, // 가장 낮은 HP — 저역을 더 남겨 *sub 까지 닿는 무게*.
  lpHz: 3000, // 가장 어두운 LP — *검은* 벽 (고역을 깎는다).
  glideTau: 0.1,
  initialDistortion: 0, // sludge 크레셴도 — 시퀀서가 0 → 72 로 ramp.
  trem: { type: 'sine', hz: 3, baseGain: 0.85, initialDepth: 0 },
}
