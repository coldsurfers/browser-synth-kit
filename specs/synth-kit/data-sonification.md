# Scene Sonification — 서울 인디씬을 소리·빛으로 (Media Art)

> 우산 문서: [`commercialization.md`](./commercialization.md) 방향 ① · VJ 백드롭([`vj-backdrop.md`](./vj-backdrop.md))의 스테이지를 캔버스로 재사용

## 목표

COLDSURF/KOPIS 공연 데이터를 `runStepClock`에 매핑해 **"이번 주 서울 인디씬"을 30–60초짜리
제너러티브 악장**으로 렌더한다 — 소리(엔진) + 빛(GL 스테이지)이 함께. 각 공연이 하나의 노트·플래시로
피어난다. *SHEVIL(표현) + COLDSURF(현실) + DEV(구조)*가 한 화면에서 만나는 미디어아트 작품이자,
그 자체로 COLDSURF 마케팅 자산(전시 커미션 / 랜딩 히어로 / B2B 데이터 스토리텔링).

핵심: **엔진·스테이지는 이미 있다. 새로 쓰는 건 "데이터 → onStep 이벤트" 매퍼(=시퀀서)뿐.**
엔진 규율 §5·§8 그대로 — 매핑은 caller 소유, 엔진 불변.

## 왜 이게 되는가 (기존 자산 재사용)

```
공연 데이터 (mock → KOPIS)
      │  매퍼(신규, caller 소유)
      ▼
runStepClock.onStep(stepIdx, when)
      ├─► 소리:  createWall / createBass / createDrumKit
      └─► 빛:   createVisualSync → createGlStage   ← VJ 백드롭에서 그대로
```
VJ 백드롭이 만든 "scheduler → 시각 동기화" 브릿지가 여기서 100% 재활용된다.
차이는 오직 *onStep 안에서 무엇을 박느냐* — 트랙 패턴 대신 **데이터**가 결정한다.

## 데이터 모델 (mock 먼저)

```ts
interface SceneEvent {
  venue: string
  geohash: string   // 위치 — 밀도 클러스터링 키 (예: 홍대 'wydm6')
  date: string      // ISO — 시간축 위치
  genre: string     // stoner / indie / punk ... → 음색·팔레트
  lineupSize: number// 라인업 규모 → 노트 세기/두께
}
```
v1 은 하드코딩된 `SceneEvent[]`(홍대/합정/상수 한 주치 mock). v2 에서 KOPIS ingest 로 교체.

## 매핑 설계 (데이터 → 소리·빛)

| 데이터 축 | → 소리 | → 빛(GL 스테이지) |
|-----------|--------|-------------------|
| `date` (주간 윈도우) | `totalSteps` 위 스텝 위치 = 언제 울리나 | 같은 when 에 hit |
| `geohash` 밀도(셀당 공연 수) | wall 두께(게인/톤 수) · 드럼 밀도 | 배경 haze 강도 · 스테이지 프리셋 |
| `genre` | 스케일/코드·엔진 선택(stoner→저역 reese, indie→wall) | `ink` 팔레트(장르별 색) |
| `lineupSize` | 노트 velocity | hit strength |
| 지역(구) | 코드 root(구별 톤 센터) | (v2) hit 위치 = geohash→x/y |

밀도 = "홍대에 이번 주 공연이 몰렸다" → 벽이 두꺼워지고 화면이 뜨거워진다. 데이터가 곧 다이내믹스.

## 목표 구조

```
demo/src/sections/
  scene.ts  (신규)   SceneEvent[] mock + 매퍼 + 엔진/스테이지 결선 + 재생 UI

packages/synth-kit/    엔진 변경 없음 (v1). 스테이지 재사용.
```
v1 은 라이브러리 코드 0줄 수정 — 데모 섹션 하나로 증명한다("지으면 존재한다").

## 레이어/설계 설명

1. **매퍼**: `SceneEvent[]` → 정렬(date) → 각 이벤트에 stepIdx 배정(주간 윈도우를 `totalSteps`로 정규화).
   geohash 로 그룹핑해 셀별 밀도 산출 → 밀도를 wall 게인/드럼 밀도에 반영.
2. **시퀀서(onStep)**: 해당 스텝에 이벤트 있으면 → 장르별 엔진 트리거 + `sync.emit(kind, when, strength)`.
   비어있는 스텝은 드론/앰비언스만 → 씬의 "숨" 유지.
3. **스테이지**: `createGlStage`(폴백 2D). 장르 팔레트로 `setPreset` 스위칭 or 프리셋 믹스.

## 상품 티어

| 티어 | 데이터 | 산출 |
|------|--------|------|
| **v1 — mock 악장** | 하드코딩 한 주치 | 데모 섹션. 전시/피치 프로토타입 |
| **v2 — KOPIS ingest** | 실데이터 + geohash 클러스터/디덥(실험 #3) | "이번 주 서울" 자동 갱신 작품 |
| **커미션/B2B** | 도시·기간 파라미터화 | "your city's scene, as sound/light" 전시·기획사 리포트 |

## 체크리스트

### 단계별 항목
- [x] 1. spec 작성 (이 문서)
- [ ] 2. `demo/src/sections/scene.ts` — `SceneEvent[]` mock (홍대/합정/상수 한 주치)
- [ ] 3. 매퍼 — date→step, geohash→밀도, genre→엔진/팔레트 매핑 함수
- [ ] 4. 시퀀서 결선 — onStep 에서 엔진 트리거 + `sync.emit`, GL 스테이지 재생
- [ ] 5. `demo/index.html`·`main.ts` 마운트 + 재생 UI(주간 스크럽/장르 범례)
- [ ] 6. `pnpm -r check:type` → `pnpm lint:fix` → `vite build` 통과
- [ ] 7. (후순위) 스테이지 `hit` 에 위치 인자 추가 → geohash→화면좌표 공간화 (라이브러리 변경)
- [ ] 8. (후순위) KOPIS ingest + geohash 디덥(실험 #3) 연결

## 변경 범위 요약

| 파일 | 변경 |
|------|------|
| `demo/src/sections/scene.ts` | 신규 — mock 데이터 + 매퍼 + 결선 + UI |
| `demo/index.html` / `demo/src/main.ts` | scene 섹션 마운트 |
| `packages/synth-kit/*` | v1 변경 없음 (v2 에서 stage 위치 인자만 선택적 추가) |
