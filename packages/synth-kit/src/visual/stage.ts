/**
 * Visual stage — 색-불문 렌더러. 오디오 엔진과 *동형*: `AudioContext`·스케줄링을 모른다.
 * canvas 와 `AnalyserNode` 만 받아 그림만 그린다. *언제 무엇을* 은 caller(시퀀서)가
 * `hit()` 으로 박는다 — createVisualStage 는 `createWall` 이 소리에 대해 그러하듯, 픽셀에 대해 color-blind.
 *
 * 두 리액티브 소스를 합성한다:
 *   - `frame(now)`  연속 배경 — analyser FFT 를 읽어 저/고역 에너지로 스펙트럼을 그린다.
 *   - `hit(kind)`   이산 펀치 — kick 플래시·chord 워시 등, 프레임마다 `preset.decay` 로 감쇠.
 */

export type HitKind = 'kick' | 'snare' | 'chord' | 'accent'

export interface StagePreset {
  /** 베이스(배경) 색. */
  bg: string
  /** 마크 팔레트 — hit·스펙트럼이 순환하며 쓴다. */
  ink: string[]
  /** 진폭 → 글로우(shadowBlur) 감도. 0 = 글로우 없음. */
  bloom: number
  /** 스펙트럼 저역/고역 분리 경계, 0..1 (binCount 비율). 예: [0.12, 0.5]. */
  bandSplit: [number, number]
  /** 스펙트럼 마크 형태. */
  mark: 'bars' | 'field' | 'rings' | 'scanline'
  /** 잔상/히트 감쇠율(프레임당), 0..1. 높을수록 길게 남는다. 예: 0.9. */
  decay: number
  /** GL 전용(옵션, 2D는 무시) — 도메인 워프/멜트 강도. 기본 1. */
  warp?: number
  /** GL 전용(옵션, 2D는 무시) — 필름 그레인. 기본 0.06. */
  grain?: number
  /** GL 전용(옵션, 2D는 무시) — 피드백 트레일 지속. 0..1. 생략 시 decay 에서 파생. */
  feedback?: number
}

export interface VisualStageHandle {
  /** rAF 마다 1프레임 — analyser 를 읽어 배경을 그리고 히트 잔상을 감쇠한다. */
  frame(now: number): void
  /** 이산 이벤트 주입. strength 0..1. */
  hit(kind: HitKind, strength: number): void
  setPreset(preset: StagePreset): void
  /** rAF 는 caller 소유 — dispose 는 관측자(ResizeObserver)만 정리한다. */
  dispose(): void
}

interface LiveHit {
  kind: HitKind
  strength: number
  ink: string
}

/**
 * 2D canvas 스테이지. 백킹 스토어 크기·DPR 은 내부 ResizeObserver 가 관리하므로
 * caller 는 canvas 를 CSS 로 배치만 하면 된다.
 */
export function createVisualStage(
  canvas: HTMLCanvasElement,
  analyser: AnalyserNode,
  initialPreset: StagePreset,
): VisualStageHandle {
  const ctx2d = canvas.getContext('2d')
  if (!ctx2d) throw new Error('createVisualStage: 2D canvas context unavailable')
  const g = ctx2d

  let preset = initialPreset
  const spectrum = new Uint8Array(analyser.frequencyBinCount)
  const hits: LiveHit[] = []
  let inkCursor = 0

  const dpr = window.devicePixelRatio || 1
  const sync = () => {
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
  }
  sync()
  const ro = new ResizeObserver(sync)
  ro.observe(canvas)

  // 밴드 평균 에너지 0..1.
  const bandEnergy = (loFrac: number, hiFrac: number) => {
    const n = spectrum.length
    const lo = Math.floor(loFrac * n)
    const hi = Math.min(n, Math.floor(hiFrac * n))
    let sum = 0
    for (let i = lo; i < hi; i++) sum += spectrum[i]
    return hi > lo ? sum / (hi - lo) / 255 : 0
  }

  const drawSpectrum = (w: number, h: number, hiE: number) => {
    const n = spectrum.length
    const bins = 64
    g.save()
    g.shadowBlur = preset.bloom * 24 * hiE
    g.shadowColor = preset.ink[0]
    for (let i = 0; i < bins; i++) {
      const v = spectrum[Math.floor((i / bins) * n)] / 255
      g.fillStyle = preset.ink[i % preset.ink.length]
      if (preset.mark === 'bars') {
        const bw = w / bins
        const bh = v * h * 0.9
        g.fillRect(i * bw, h - bh, bw * 0.8, bh)
      } else if (preset.mark === 'field') {
        const bw = w / bins
        const bh = v * h * 0.5
        g.fillRect(i * bw, h / 2 - bh, bw * 0.8, bh * 2)
      } else if (preset.mark === 'scanline') {
        const y = (i / bins) * h
        g.globalAlpha = v
        g.fillRect(0, y, w, Math.max(1, (h / bins) * 0.6))
        g.globalAlpha = 1
      } else {
        // rings — 중심에서 확산
        const r = (i / bins) * Math.min(w, h) * 0.5 * (0.5 + v)
        g.globalAlpha = v * 0.8
        g.beginPath()
        g.arc(w / 2, h / 2, r, 0, Math.PI * 2)
        g.lineWidth = 2 * dpr
        g.strokeStyle = preset.ink[i % preset.ink.length]
        g.stroke()
        g.globalAlpha = 1
      }
    }
    g.restore()
  }

  const drawHits = (w: number, h: number) => {
    for (const hit of hits) {
      const s = hit.strength
      g.save()
      g.globalAlpha = Math.min(1, s)
      if (hit.kind === 'kick') {
        const rad = Math.min(w, h) * (0.6 - s * 0.3)
        const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, rad)
        grd.addColorStop(0, hit.ink)
        grd.addColorStop(1, 'transparent')
        g.fillStyle = grd
        g.fillRect(0, 0, w, h)
      } else if (hit.kind === 'snare') {
        g.fillStyle = hit.ink
        g.fillRect(0, h * (0.5 - s * 0.5), w, Math.max(2, h * 0.02))
      } else if (hit.kind === 'chord') {
        g.globalAlpha = s * 0.35
        g.fillStyle = hit.ink
        g.fillRect(0, 0, w, h)
      } else {
        // accent — 확산 링
        g.strokeStyle = hit.ink
        g.lineWidth = 3 * dpr
        g.beginPath()
        g.arc(w / 2, h / 2, Math.min(w, h) * (0.5 - s * 0.4), 0, Math.PI * 2)
        g.stroke()
      }
      g.restore()
    }
  }

  return {
    frame() {
      const w = canvas.width
      const h = canvas.height
      analyser.getByteFrequencyData(spectrum)
      const hiE = bandEnergy(preset.bandSplit[0], preset.bandSplit[1])

      // 이전 프레임을 bg 로 페이드 → 잔상(모션 트레일). 알파는 decay 의 여집합.
      g.globalAlpha = 1 - preset.decay
      g.fillStyle = preset.bg
      g.fillRect(0, 0, w, h)
      g.globalAlpha = 1

      drawSpectrum(w, h, hiE)
      drawHits(w, h)

      // 히트 감쇠 + 컬링.
      for (let i = hits.length - 1; i >= 0; i--) {
        hits[i].strength *= preset.decay
        if (hits[i].strength < 0.02) hits.splice(i, 1)
      }
    },
    hit(kind, strength) {
      const ink = preset.ink[inkCursor % preset.ink.length]
      if (kind === 'chord') inkCursor++ // 코드 전환마다 팔레트를 돌린다
      hits.push({ kind, strength: Math.max(0, Math.min(1, strength)), ink })
    },
    setPreset(next) {
      preset = next
    },
    dispose() {
      ro.disconnect()
    },
  }
}
