/**
 * Dub chamber — dub-relay·dub-holy·dub-power 가 글자 그대로 복제하던 *마스터/믹스 챔버* 를 한
 * 모듈로. drumkit·sunwall 과 같은 VST 모델: `createDubChamber` 은 *색-불문 챔버 엔진*,
 * `*_CHAMBER` 은 *패치*. 챔버는 *세 단의 직렬 믹스* 만 소유한다 —
 *
 *   ① 사이드체인 ducking : kick 이 떨어지면 chord·pad·sub(=`ductable`)가 잠깐 눌린다.
 *      drum/perc(=`drumBus`)는 우회해 *직격* 으로 친다.
 *   ② dub delay return   : cross-feedback stereo delay → HP+LP → return → ductable(덥 tail 도 호흡).
 *      send 량의 *per-section automation* 은 트랙에 남는다(`dubSend` 노드만 노출).
 *   ③ tape saturation    : soft-clip(tanh) waveshaper → 마스터 lowpass → masterOut → destination.
 *
 * 챔버 밖(트랙)에 남는 것: voice 합성(kick·chord·pad·…), dubSend 의 section 곡선, 16th 시퀀스.
 * 16th lookahead 루프는 `../scheduler` 의 `runStepClock` 으로 따로 추출됐다.
 * 보존 기준: 노드 토폴로지·상수 그대로 — 순수 추출.
 */

/** soft-clip(tanh) saturation. drive=k. drumkit 의 attackTo 처럼 챔버 공용 1줄. */
function makeSaturationCurve(drive: number): Float32Array<ArrayBuffer> {
  const n = 1024
  const buffer = new ArrayBuffer(n * Float32Array.BYTES_PER_ELEMENT)
  const curve = new Float32Array(buffer)
  const denom = Math.tanh(drive)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(drive * x) / denom
  }
  return curve
}

/** 마스터 단 — tape lowpass + soft-clip saturation. */
export interface MasterStage {
  /** tape lowpass 컷(Hz). relay/power 12k, holy 14k. */
  lowpassHz: number
  /** tanh saturation drive. relay 2.4, holy 2.0, power 2.2. */
  satDrive: number
}

/** 마스터 fade in/out envelope. */
export interface FadeStage {
  /** 0 → 1 까지 linear ramp 시간(초). */
  inSec: number
  /** 끝나기 `outLeadSec` 초 전부터 exp ramp → 0. */
  outLeadSec: number
}

/** kick 사이드체인 duck — ductable 을 눌렀다 복귀. */
export interface DuckStage {
  /** 눌리는 최저 gain. relay 0.7(완만), holy/power 0.55(깊게). */
  min: number
  /** min 도달 시간(초). */
  attackSec: number
  /** 1.0 복귀 완료 시간(초). half-time 일수록 길다. */
  recoverSec: number
}

/** dub delay return — cross-feedback stereo delay + HP/LP tail. */
export interface DelayStage {
  /** DelayNode maxDelayTime. */
  maxSec: number
  /** L delay(점음 8분), R delay(4분). */
  timeL: number
  timeR: number
  /** cross feedback gain. */
  feedback: number
  /** tail HP(sub 분리) / LP(dark dub). */
  hpHz: number
  lpHz: number
  /** return gain — 두께. */
  returnGain: number
}

export interface DubChamberPreset {
  master: MasterStage
  fade: FadeStage
  duck: DuckStage
  delay: DelayStage
}

export interface DubChamber {
  /** chord·pad·sub·reese 가 모이는 *ducked* bus. */
  readonly ductable: GainNode
  /** drum·perc 가 모이는 *duck 우회* bus. */
  readonly drumBus: GainNode
  /** dub delay send. 트랙이 section 별로 gain automation. */
  readonly dubSend: GainNode
  /** kick 마다 호출 — ductable 을 눌렀다 복귀(사이드체인). */
  duck(when: number): void
  /** 마스터 fade in/out 을 한 번에 스케줄. start=그리드 원점, totalSec=곡 길이. */
  open(start: number, totalSec: number): void
  /** teardown — 빠른 fade out 후 250 ms 뒤 챔버 노드 전부 disconnect. */
  dispose(): void
}

/**
 * dub 마스터/믹스 챔버를 만들어 핸들을 돌려준다. 트랙 voice 는 `ductable`·`drumBus`·`dubSend`
 * 에 연결하고, kick 마다 `duck(when)`, 시작에 `open(start, total)`, teardown 에 `dispose()`.
 *
 * @param destination 트랙 score 가 받은 최종 목적지(AudioContext.destination 등).
 */
export function createDubChamber(
  ctx: AudioContext,
  destination: AudioNode,
  preset: DubChamberPreset,
): DubChamber {
  const { master, fade, duck, delay } = preset

  // ─── 마스터: tape lowpass ← saturation ← masterOut ← destination ──────────
  const masterTape = ctx.createBiquadFilter()
  masterTape.type = 'lowpass'
  masterTape.frequency.value = master.lowpassHz
  masterTape.Q.value = 0.5

  const masterSat = ctx.createWaveShaper()
  masterSat.curve = makeSaturationCurve(master.satDrive)
  masterSat.oversample = '4x'

  const masterOut = ctx.createGain()
  masterOut.gain.value = 0.0001 // 시작 mute, open() 에서 fade in

  masterTape.connect(masterSat).connect(masterOut).connect(destination)

  // sum bus — 모든 voice 가 (ductable/drumBus 경유로) 모인다.
  const bus = ctx.createGain()
  bus.gain.value = 1
  bus.connect(masterTape)

  // ductable — chord/pad/sub. kick 시 눌린다. drumBus — drum/perc, 우회 직결.
  const ductable = ctx.createGain()
  ductable.gain.value = 1
  ductable.connect(bus)

  const drumBus = ctx.createGain()
  drumBus.gain.value = 1
  drumBus.connect(bus)

  // ─── dub delay return — cross-feedback stereo ────────────────────────────
  const dubSend = ctx.createGain()
  dubSend.gain.value = 0 // 트랙이 section 별로 modulate

  const delayL = ctx.createDelay(delay.maxSec)
  const delayR = ctx.createDelay(delay.maxSec)
  delayL.delayTime.value = delay.timeL
  delayR.delayTime.value = delay.timeR

  const fbL = ctx.createGain()
  const fbR = ctx.createGain()
  fbL.gain.value = delay.feedback
  fbR.gain.value = delay.feedback

  const dubHP = ctx.createBiquadFilter()
  dubHP.type = 'highpass'
  dubHP.frequency.value = delay.hpHz
  const dubLP = ctx.createBiquadFilter()
  dubLP.type = 'lowpass'
  dubLP.frequency.value = delay.lpHz
  dubLP.Q.value = 0.7

  const dubReturn = ctx.createGain()
  dubReturn.gain.value = delay.returnGain

  // dubSend → delayL/R, cross feedback, 두 출력 → HP → LP → return → ductable(덥 tail 도 호흡).
  dubSend.connect(delayL)
  dubSend.connect(delayR)
  delayL.connect(fbL)
  fbL.connect(delayR)
  delayR.connect(fbR)
  fbR.connect(delayL)
  delayL.connect(dubHP)
  delayR.connect(dubHP)
  dubHP.connect(dubLP).connect(dubReturn).connect(ductable)

  return {
    ductable,
    drumBus,
    dubSend,

    duck(when) {
      ductable.gain.cancelScheduledValues(when)
      ductable.gain.setValueAtTime(ductable.gain.value, when)
      ductable.gain.linearRampToValueAtTime(duck.min, when + duck.attackSec)
      ductable.gain.linearRampToValueAtTime(1.0, when + duck.recoverSec)
    },

    open(start, totalSec) {
      masterOut.gain.setValueAtTime(0.0001, start)
      masterOut.gain.linearRampToValueAtTime(1.0, start + fade.inSec)
      masterOut.gain.setValueAtTime(1.0, start + totalSec - fade.outLeadSec)
      masterOut.gain.exponentialRampToValueAtTime(0.0001, start + totalSec)
      // 평시 1.0 — kick 마다 duck() 가 눌렀다 복귀.
      ductable.gain.setValueAtTime(1, start)
    },

    dispose() {
      // 빠른 fade out — abrupt stop 방지.
      const now = ctx.currentTime
      try {
        masterOut.gain.cancelScheduledValues(now)
        masterOut.gain.setValueAtTime(masterOut.gain.value, now)
        masterOut.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
      } catch {
        // 무해
      }
      // 250 ms 후 챔버 노드 전부 disconnect.
      window.setTimeout(() => {
        try {
          bus.disconnect()
          ductable.disconnect()
          drumBus.disconnect()
          dubSend.disconnect()
          delayL.disconnect()
          delayR.disconnect()
          fbL.disconnect()
          fbR.disconnect()
          dubHP.disconnect()
          dubLP.disconnect()
          dubReturn.disconnect()
          masterTape.disconnect()
          masterSat.disconnect()
          masterOut.disconnect()
        } catch {
          // 이미 정리됨
        }
      }, 250)
    },
  }
}
