/**
 * Step clock — catalog 트랙들이 글자 그대로 복제하던 *lookahead 16th 스케줄러* 를 한 transport
 * 헬퍼로. `setInterval` 의 jitter 없이 `AudioContext.currentTime` 위에 앞창(lookahead)을 열고
 * 그 안에 든 step 만 *정확한 절대시간* 으로 schedule 한다.
 *
 * 색-불문 · 음색-불문 — 그저 `(stepIdx, when)` 을 박는다. *언제 무엇을* 은 `onStep` 콜백(트랙의
 * 시퀀서)에 남는다. 보존 기준: 기존 트랙들의 `LOOKAHEAD = 0.1` · `TICK_MS = 25` · `while` 창
 * 채우기 루프와 *동작 동일* — 순수 추출.
 */

export interface StepClockOptions {
  /** 그리드 원점(절대시간, 보통 ctx.currentTime + 0.1). step 0 의 시각. */
  start: number
  /** step 간격(초). 16th = 60 / BPM / 4. */
  step: number
  /** 마지막 step + 1. when 이 아니라 *개수* 로 끝을 막는다. */
  totalSteps: number
  /** 창 안에 든 각 step 을 박는다 — 트랙의 시퀀서. */
  onStep: (stepIdx: number, when: number) => void
  /** 앞창 길이(초). 기본 0.1. */
  lookahead?: number
  /** tick 주기(ms). 기본 25. */
  tickMs?: number
}

export interface StepClock {
  /** interval 정지 + 이후 tick no-op. teardown 에서 호출. */
  stop(): void
}

/**
 * lookahead 스텝 클럭을 돌린다. 즉시 첫 tick 을 한 번 박고, 이후 `tickMs` 마다 앞창을 채운다.
 */
export function runStepClock(
  ctx: AudioContext,
  { start, step, totalSteps, onStep, lookahead = 0.1, tickMs = 25 }: StepClockOptions,
): StepClock {
  let nextStep = 0
  let stopped = false

  const tick = () => {
    if (stopped) return
    const horizon = ctx.currentTime + lookahead
    while (true) {
      const when = start + nextStep * step
      if (when > horizon) break
      if (nextStep >= totalSteps) break
      onStep(nextStep, when)
      nextStep++
    }
  }

  const intervalId = window.setInterval(tick, tickMs)
  tick()

  return {
    stop() {
      stopped = true
      window.clearInterval(intervalId)
    },
  }
}
