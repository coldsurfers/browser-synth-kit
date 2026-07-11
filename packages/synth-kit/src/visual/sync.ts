/**
 * Visual sync — scheduler 와 stage 사이의 결선. *lookahead 함정* 을 여기서 흡수한다.
 *
 * `runStepClock.onStep(stepIdx, when)` 은 소리를 *미래 시각*(when ≈ now + lookahead)에 미리 박는다.
 * onStep 안에서 바로 그림을 그리면 비주얼이 소리보다 ~100ms 빠르다. 그래서 이벤트를 큐에 쌓고,
 * rAF 루프가 `when <= ctx.currentTime` 인 것만 소비해 *소리와 같은 순간* 에 stage.hit() 을 박는다.
 *
 * caller 결선:
 *   onStep(i, when): ...소리 시퀀싱...; if (kick) sync.emit('kick', when, vel)
 *   sync.start()   // rAF 시작
 */
import type { HitKind, VisualStageHandle } from './stage'

interface QueuedHit {
  kind: HitKind
  when: number
  strength: number
}

export interface VisualSync {
  /** onStep 에서 호출 — 이벤트를 큐에 넣는다(즉시 그리지 않음). */
  emit(kind: HitKind, when: number, strength: number): void
  /** rAF 루프 시작: 만기 이벤트를 hit() 로 방출하고 매 프레임 stage.frame() 을 그린다. */
  start(): void
  stop(): void
  /** stop() + 큐 비움. */
  dispose(): void
}

export function createVisualSync(ctx: AudioContext, stage: VisualStageHandle): VisualSync {
  // onStep 의 when 은 단조 증가하므로 append + front 드레인으로 충분.
  const queue: QueuedHit[] = []
  let head = 0
  let raf = 0
  let running = false

  const loop = () => {
    if (!running) return
    const now = ctx.currentTime
    while (head < queue.length && queue[head].when <= now) {
      const h = queue[head++]
      stage.hit(h.kind, h.strength)
    }
    // 소비분 압축(메모리 누수 방지) — 밀린 게 없으면 리셋.
    if (head > 512 && head === queue.length) {
      queue.length = 0
      head = 0
    }
    stage.frame(now)
    raf = window.requestAnimationFrame(loop)
  }

  return {
    emit(kind, when, strength) {
      queue.push({ kind, when, strength })
    },
    start() {
      if (running) return
      running = true
      raf = window.requestAnimationFrame(loop)
    },
    stop() {
      running = false
      if (raf) window.cancelAnimationFrame(raf)
      raf = 0
    },
    dispose() {
      this.stop()
      queue.length = 0
      head = 0
    },
  }
}
