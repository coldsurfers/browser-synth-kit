/**
 * Channel strip — *공간/믹스* 어휘의 공유 도구. sunwall·drumkit·dub·bass 가 한 트랙에서
 * 동시에 울릴 때 저-중역이 겹쳐 뭉개지는 문제를, 악기 *밖* 의 per-instrument 채널 스트립으로
 * 푼다(패닝 + carve EQ). VST 모델: `createStrip` 은 *믹서 한 채널*, `StripPreset` 은 *그 설정*.
 *
 * 엔진은 무변경. 모든 엔진이 출력을 *주입받은 `AudioNode` bus* 로만 쓰므로(`createWall(ctx, bus,…)`
 * 등), 스트립은 그 `bus` 자리에 끼워넣는 한 노드 묶음일 뿐이다 — 엔진 시그니처·내부 그래프 불변.
 *
 *   input(trim gain) → [HP] → [LP] → [bell peaking] → StereoPanner → dest
 *
 * **옵트인 불변식**: preset 의 carve 필드(`hpHz`·`lpHz`·`bell`)는 *있을 때만* 노드를 만든다
 * (sunwall 의 `bend` 미지정 = 미생성 패턴). 빈 preset(`{}`)이면 trim gain(=1) + StereoPanner(pan 0)
 * 뿐 → 센터 모노로 투명. 즉 트랙이 *명시적으로* preset 을 줄 때만 소리가 변한다.
 *
 * offline wav 렌더(실 Chromium `OfflineAudioContext` 바운스) 호환: `StereoPannerNode`·
 * `BiquadFilterNode` 는 표준 노드라 별도 facade 불필요(하니스 `scripts/sound-render-harness.ts`).
 */

export interface StripPreset {
  /** StereoPanner pan. -1(L)~+1(R). 기본 0(센터·모노 유지). */
  pan?: number
  /** carve HP cutoff(Hz). 베이스/킥 자리 비우기. 기본 미생성(bypass). */
  hpHz?: number
  /** HP Q. 기본 BiquadFilter 기본값(0.7071). */
  hpQ?: number
  /** carve LP cutoff(Hz). 위 악기에 고역 양보. 기본 미생성(bypass). */
  lpHz?: number
  /** LP Q. 기본 BiquadFilter 기본값. */
  lpQ?: number
  /** 보충 notch/peak — 특정 충돌 대역만 ±dB(예: 벽 250Hz -3dB). 기본 미생성(bypass). */
  bell?: { hz: number; q: number; gainDb: number }
  /** 스트립 트림 gain. 기본 1. */
  gain?: number
}

export interface StripHandle {
  /** 엔진이 출력을 꽂는 입력 노드(= 체인 맨 앞 trim gain). */
  readonly input: AudioNode
  /** pan 을 value 로 ramp(섹션 자동화용·옵션). rampSec<=0 이면 즉시. */
  setPan(value: number, rampSec: number): void
  /** stop 없음 — 패시브 체인. 전체 노드 disconnect. */
  dispose(): void
}

/**
 * 채널 스트립을 만들어 `dest` 앞에 끼운다. 엔진은 돌려받은 `input` 으로 출력을 꽂는다.
 *
 * carve 필드(`hpHz`·`lpHz`·`bell`)는 *있을 때만* 노드를 만든다 — 빈 preset 은 trim gain +
 * pan 0 panner 뿐(투명).
 *
 * @param dest 스트립 출력이 연결될 목적지(트랙의 ductable·master 등).
 */
export function createStrip(ctx: AudioContext, dest: AudioNode, preset: StripPreset): StripHandle {
  // 체인 맨 앞 = trim gain. 엔진이 여기 꽂는다(빈 preset 이면 gain 1 → 투명).
  const input = ctx.createGain()
  input.gain.value = preset.gain ?? 1

  // 패시브 노드 모음 — dispose 시 전부 disconnect.
  const nodes: AudioNode[] = [input]
  let tail: AudioNode = input

  // carve 필터 Q 기본 = 1/√2(Butterworth, 평탄). BiquadFilter 의 기본 Q 는 1 이라 cutoff 에
  // +1.25 dB *공진 봉우리* 가 생기는데, carve(자리 비우기)용 필터엔 부적절하다 — 봉우리가 깎으려던
  // 대역(예: 150~200 Hz)에 오히려 에너지를 더해, 모인 신호가 챔버 saturation rail 을 더 세게 때린다.
  const BUTTERWORTH_Q = Math.SQRT1_2

  if (preset.hpHz !== undefined) {
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = preset.hpHz
    hp.Q.value = preset.hpQ ?? BUTTERWORTH_Q
    tail.connect(hp)
    nodes.push(hp)
    tail = hp
  }

  if (preset.lpHz !== undefined) {
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = preset.lpHz
    lp.Q.value = preset.lpQ ?? BUTTERWORTH_Q
    tail.connect(lp)
    nodes.push(lp)
    tail = lp
  }

  if (preset.bell !== undefined) {
    const bell = ctx.createBiquadFilter()
    bell.type = 'peaking'
    bell.frequency.value = preset.bell.hz
    bell.Q.value = preset.bell.q
    bell.gain.value = preset.bell.gainDb
    tail.connect(bell)
    nodes.push(bell)
    tail = bell
  }

  // panner 는 항상 존재(pan 0 = 투명). setPan 자동화의 고정 핸들.
  const panner = ctx.createStereoPanner()
  panner.pan.value = preset.pan ?? 0
  tail.connect(panner).connect(dest)
  nodes.push(panner)

  return {
    input,
    setPan(value: number, rampSec: number) {
      const now = ctx.currentTime
      panner.pan.cancelScheduledValues(now)
      if (rampSec <= 0) {
        panner.pan.setValueAtTime(value, now)
        return
      }
      panner.pan.setValueAtTime(panner.pan.value, now)
      panner.pan.linearRampToValueAtTime(value, now + rampSec)
    },
    dispose() {
      for (const node of nodes) node.disconnect()
    },
  }
}
