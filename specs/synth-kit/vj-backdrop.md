# COLDSURF VJ 백드롭 — 제너러티브 공연 비주얼

> 우산 문서: [`commercialization.md`](./commercialization.md) 방향 ④

## 목표

synth-kit의 사운드를 **공연장에 쏘는 풀스크린 비주얼**로 확장한다.
운영자가 브라우저를 프로젝터에 연결 → 프리셋 선택 → 재생하면, 소리에 **프레임 단위로 동기화된**
제너러티브 배경이 나온다. COLDSURF 공연/ SHEVIL 라이브 셋의 백드롭 자산 + 공연장 라이선스 상품.

핵심 철학은 오디오 쪽과 **동일**하다 — *엔진은 색-불문, 프리셋이 색, 싱크는 caller가 소유*.
비주얼도 VST-not-framework로 짓는다.

## 현재 문제 / 설계 함정

1. **scheduler는 lookahead 방식이다.** `onStep(stepIdx, when)`은 *미래 시각*(`when ≈ now + 0.1s`)에
   박을 이벤트를 미리 준다. `onStep` 안에서 바로 그림을 그리면 **비주얼이 소리보다 ~100ms 빠르다.**
   → 이벤트를 큐에 쌓고, `requestAnimationFrame` 루프가 `when <= ctx.currentTime`인 것만 소비해야 싱크가 맞는다.
2. **두 개의 리액티브 소스가 섞여야 한다.**
   - `AnalyserNode`(연속 FFT/파형) → *부드러운 배경 레이어* (밴드별 에너지 = 밝기/두께)
   - scheduler 이벤트 큐(이산 스텝 히트) → *펀치 레이어* (kick=플래시, 코드 전환=색 이동)
   연속만 쓰면 밋밋하고, 이산만 쓰면 죽어있다. 둘 다 필요.
3. **프로젝터 제약.** 어두운 무대·저해상도·먼 거리 → 고대비·굵은 형태·미세 디테일 금지.

## 목표 구조

오디오 엔진 서브폴더 규칙을 그대로 복제한다 (`<engine>.ts` + `<engine>s.ts` + `index.ts`).

```
packages/synth-kit/src/
  visual/
    stage.ts       createVisualStage — 색-불문 렌더러 (canvas + analyser → 프레임)
    stages.ts      StagePreset 상수들 (SUN_STAGE, BLACK_STAGE, BLUE_STAGE ... wall과 짝)
    sync.ts        createVisualSync — scheduler onStep → 이벤트 큐 → rAF 드레인 브릿지
    index.ts       배럴 (./visual 로 export, package.json exports + tsup + 서브패스에 등록)

demo/src/
  sections/
    vj.ts   (신규)  풀스크린 백드롭 데모 — tape 트랙(방향 ④ v1)에 비주얼 싱크
```

`./visual`은 새 지원 서브패스. `package.json` `exports`, `tsup.config.ts` entry, AGENTS.md §2에 등록.

## 레이어/설계 설명

### 1. 엔진 — `createVisualStage` (색-불문)
```ts
function createVisualStage(
  canvas: HTMLCanvasElement,
  analyser: AnalyserNode,   // master 버스에서 tap한 실시간 스펙트럼
  preset: StagePreset,
): VisualStageHandle

interface VisualStageHandle {
  frame(now: number): void          // rAF마다 1프레임 — analyser 읽어 배경 그리고, 히트 잔상 감쇠
  hit(kind: HitKind, strength: number): void   // 이산 이벤트 주입 (kick/chord/snare...)
  setPreset(preset: StagePreset): void
  dispose(): void
}
type HitKind = 'kick' | 'snare' | 'chord' | 'accent'
```
- 스케줄링·오디오 tap을 *모른다*. canvas와 analyser만 받고 그림만 그린다. (엔진 규율 §5와 동형)
- 내부: 연속 배경(analyser FFT bins → `preset.bandSplit`로 lo/hi 분리) + 히트 파티클/플래시(감쇠).

### 2. 프리셋 — `StagePreset` (색)
```ts
interface StagePreset {
  bg: string                 // 베이스 색
  ink: string[]              // 마크 팔레트
  bloom: number              // 진폭 → 글로우 감도
  bandSplit: [number, number]// FFT bin 경계 (저역/고역 레이어 분리)
  mark: 'scanline' | 'bars' | 'rings' | 'field'
  decay: number              // 히트 잔상 감쇠율
}
```
wall 프리셋과 **이름·무드로 짝**을 맞춘다 (VJ가 "벽"을 고르면 배경도 그 색):

| Stage 프리셋 | 짝 Wall | 무드 |
|------|------|------|
| `SUN_STAGE` | SUNWALL | 웜 앰버 블룸 |
| `BLACK_STAGE` | BLACKWALL | 근-블랙 + 화이트 스캔라인 |
| `BLUE_STAGE` | BLUEWALL | 콜드 시안 필드 |
| `HATE_STAGE` | SUBLIME_HATE_WALL | 고대비 노이즈 |

### 3. 싱크 브릿지 — `createVisualSync` (caller가 소유하는 결선)
lookahead 함정을 여기서 흡수한다.
```ts
function createVisualSync(ctx: AudioContext, stage: VisualStageHandle): VisualSync
interface VisualSync {
  emit(kind: HitKind, when: number, strength: number): void  // onStep에서 호출 — 큐에 넣음
  start(): void   // rAF 루프 시작: when<=currentTime 인 이벤트 hit()로 방출 + 매 프레임 stage.frame()
  stop(): void
  dispose(): void
}
```
결선 (데모 `vj.ts`가 소유):
```
runStepClock.onStep(stepIdx, when):
  ...소리 시퀀싱 (기존 tape.ts 로직)...
  if (kick)  sync.emit('kick', when, vel)
  if (chord) sync.emit('chord', when, 1)

rAF 루프 (sync 내부):
  const now = ctx.currentTime
  while (queue[0]?.when <= now) stage.hit(...queue.shift())   // 소리와 같은 순간에 플래시
  stage.frame(now)                                            // analyser 연속 레이어
```
`AnalyserNode`는 master 버스에서 tap: `master.connect(analyser)` (analyser는 destination에 연결 안 함 = 소리 영향 0).

## 상품 티어 (수익 구조)

| 티어 | 오디오 소스 | 싱크 방식 | 판매 |
|------|------|------|------|
| **v1 — 제너러티브 셋** | synth-kit 자체 트랙(tape) | scheduler 이벤트 = 완벽 결정론 싱크 | 백드롭 URL 라이선스 / 커미션 |
| **v2 — 라이브 리액티브** | 실제 밴드 line-in(마이크/오디오 인터페이스) | AnalyserNode만 (이벤트 없음) | 공연장 상시 설치 |

v1은 이미 있는 `tape.ts` 트랙 위에 얹으므로 **라이브 입력 없이** 오늘 증명 가능.
v2는 `getUserMedia` line-in → 같은 `createVisualStage`(analyser만) 재사용 = 엔진 불변, 소스만 교체.

## 기술 선택 (과도한 시도 금지)

- **v1은 2D Canvas.** WebGL/셰이더는 v2 이후. 2D로 "데이터가 소리+그림이 된다"를 가장 빠르게 증명.
- 단, `VisualStageHandle` 추상이 렌더러를 감싸므로 후에 WebGL 스테이지로 **엔진만 교체** 가능.
- 새 런타임 의존성 0 (canvas·rAF·Web Audio 전부 브라우저 기본).

## 체크리스트

### 단계별 항목
- [x] 1. spec 작성 (이 문서)
- [x] 2. `packages/synth-kit/src/visual/stage.ts` — `createVisualStage` (2D canvas, analyser 연속 + hit 이산)
- [x] 3. `packages/synth-kit/src/visual/stages.ts` — SUN/BLACK/BLUE/HATE STAGE 프리셋
- [x] 4. `packages/synth-kit/src/visual/sync.ts` — `createVisualSync` (큐 + rAF 드레인)
- [x] 5. `packages/synth-kit/src/visual/index.ts` + `package.json` exports + `tsup.config.ts` + AGENTS.md §2 등록
- [x] 6. `demo/src/sections/vj.ts` — 풀스크린 백드롭 데모 (tape 트랙 + 싱크), `demo/index.html`·`main.ts` 마운트
- [x] 7. `pnpm build` → `pnpm -r check:type` → `pnpm lint:fix` 통과 (+ `vite build` 통과)
- [x] 8. changeset 추가 (`.changeset/vj-backdrop-visual-stage.md`, minor)
- [x] 9. WebGL 스테이지 — `createGlStage` (ping-pong 피드백 스미어 + 블룸 + CA + 그레인). 데모 GL 선호/2D 폴백, 렌더러 배지
- [ ] 8b. (사용자) 브라우저/프로젝터 실물 확인 — `pnpm --filter demo dev`
- [ ] 10. (후순위) v2 line-in 리액티브 + 데이터 소니피케이션(`data-sonification.md`)에 스테이지 재사용

## 변경 범위 요약

| 파일 | 변경 |
|------|------|
| `packages/synth-kit/src/visual/stage.ts` | 신규 — 렌더러 엔진 |
| `packages/synth-kit/src/visual/stages.ts` | 신규 — 스테이지 프리셋 |
| `packages/synth-kit/src/visual/sync.ts` | 신규 — scheduler→canvas 싱크 브릿지 |
| `packages/synth-kit/src/visual/index.ts` | 신규 — 배럴 |
| `packages/synth-kit/package.json` | `exports`에 `./visual` 추가 |
| `packages/synth-kit/tsup.config.ts` | entry에 visual 추가 |
| `AGENTS.md` | §2에 visual 엔진 시그니처 등록 |
| `demo/src/sections/vj.ts` | 신규 — 풀스크린 백드롭 데모 |
| `demo/index.html` / `demo/src/main.ts` | vj 섹션 마운트 |
