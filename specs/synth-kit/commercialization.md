# synth-kit 상업화 방향 — Media Art & Beyond

## 목표

`@coldsurf/synth-kit`을 "오픈소스 브라우저 신스 라이브러리"에서 **수익이 나는 자산**으로
확장하는 방향들을 한 곳에 정리한다. 각 방향은 *같은 엔진*을 재사용하며, 개별 spec으로 분기한다.
이 문서는 인덱스이자 전략 근거.

## 이 도구의 진짜 상업적 자산 (왜 팔리는가)

synth-kit의 세 가지 구조적 속성이 곧 상업 가치다.

| 속성 | 상업적 의미 |
|------|-------------|
| **브라우저 client-side** | 서버·스트리밍 비용 0. 설치 없음. URL 하나로 배포. |
| **무한 비반복 생성** | 저작권료(royalty) 문제가 구조적으로 없음 — 브랜드가 BGM에서 가장 두려워하는 지점을 제거. |
| **`preset`=색 / `scheduler`=시간 분리** | 외부 데이터를 `runStepClock`에 꽂으면 그대로 "데이터 → 소리". Media Art의 관문. |

마지막 줄(`onStep(stepIdx, when)`에 임의 데이터 주입)이 미디어아트 확장의 뿌리다.

## 방향 카탈로그 (추천순)

### ① COLDSURF 데이터 소니피케이션 — 3개 정체성이 겹치는 지점
KOPIS/geohash 공연 데이터를 `onStep`에 매핑: 홍대 밀도 = wall 두께, 각 공연 = 노트, 지역 = 팬.
*SHEVIL(표현) + COLDSURF(현실) + DEV(구조)*가 한 화면에서 만나는 작품이자 COLDSURF 마케팅 자체.
- 수익: 전시 커미션 / 랜딩페이지 히어로 재사용 / B2B 데이터 스토리텔링
- spec: **`specs/synth-kit/data-sonification.md`** (작성됨 — VJ 스테이지 재사용, v1 구현 대기)

### ② 로열티-프리 무한 앰비언트 as a Service — 가장 빠른 현금
브랜드 마이크로사이트·제품 런칭 페이지·리테일/호스피탈리티(대기실 앰비언트) 대상.
판매 문구: *"라이선스료 없는, 절대 반복되지 않는 공간 사운드. URL 하나."*
- 수익: 프로젝트 단가 / 프리셋 라이선스 / 유지보수
- spec: `specs/synth-kit/ambient-service.md` (미착수)

### ③ SHEVIL web-native 생성 릴리즈
정적 트랙 대신 "끝나지 않는" 웹 곡을 URL로 발매. pay-what-you-want, NFT 없는 순수 웹.
DIY 팬 전략(Bandcamp 모델)과 정합.
- 수익: PWYW 릴리즈 / 팬 유입 퍼널
- spec: `specs/synth-kit/generative-release.md` (미착수)

### ④ COLDSURF 공연용 제너러티브 비주얼 / VJ 백드롭 — ★ 현재 진행
`runStepClock`이 결정론적 타이밍을 주므로 오디오-리액티브 비주얼을 프레임 단위로 동기화 가능.
공연장/기획사에 라이선스. ①·④는 "scheduler → 시각 동기화"라는 같은 뼈대를 공유 → 먼저 지으면 넷 다로 뻗음.
- 수익: 공연 백드롭 라이선스 / 커미션 / SHEVIL 라이브 셋 자산
- spec: **`specs/synth-kit/vj-backdrop.md`** ← 이번 작업

## 공유 뼈대 (왜 ④를 먼저 짓는가)

①과 ④는 기술적으로 동일한 심장을 쓴다:

```
데이터/시퀀서 → runStepClock.onStep(stepIdx, when) → [ 소리 | 그림 ]
```

④(VJ 백드롭)의 "scheduler → canvas 동기화" 브릿지를 만들면, ①(소니피케이션)의 시각 레이어로
그대로 재활용된다. "지으면 존재한다" — 가장 작은 증명 하나로 4방향을 연다.

## 체크리스트

- [x] 1. 상업화 방향 카탈로그 작성 (이 문서)
- [x] 2. ④ VJ 백드롭 상세 spec 분기 (`vj-backdrop.md`)
- [ ] 3. ④ MVP 구현 (별도 spec 체크리스트)
- [ ] 4. ①②③ spec은 ④ 검증 후 우선순위 재평가

## 변경 범위 요약

| 산출물 | 상태 |
|--------|------|
| `specs/synth-kit/commercialization.md` | 신규 (인덱스) |
| `specs/synth-kit/vj-backdrop.md` | 신규 (이번 深掘) |
| `data-sonification.md` / `ambient-service.md` / `generative-release.md` | 미착수 (후순위) |
