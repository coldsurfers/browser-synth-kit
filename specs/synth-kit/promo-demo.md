# synth-kit 홍보 — "Play the Tape" 히어로 데모

## 목표

`@coldsurf/synth-kit`의 유일하고 강력한 후크는 **"샘플 하나 없이 코드만으로 나오는 음악"**이다.
지금 데모는 엔진을 하나씩 따로 재생하는 playground라 그 후크를 귀로 증명하지 못한다.

데모 자체를 마케팅 자산으로 만든다: 버튼 하나로 wall + drumkit + bass + space + scheduler를
엮은 **완성된 제너러티브 트랙**을 재생하고, 그 소리를 만든 실제 코드를 바로 보여준다.
(Code To Product — 들은 소리 → 그걸 만든 코드가 한눈에.)

무드: **Shoegaze/Wall 중심** — `SUNWALL` + `WET_KIT`(gated snare) + 서브 베이스.

## 현재 문제

- 히어로가 없다. 방문자가 "이 패키지로 뭐가 나오는가"를 5초 안에 듣지 못한다.
- 전 엔진 합주 예시가 없어 "조합"이라는 핵심 가치가 안 보인다.
- README Quickstart가 실제 API와 어긋난다(`createWall(ctx, dest, SUNWALL)` +
  `fadeIn`/`update`/`setChord(0)` → 실제론 `initialTones` 인자 · `rampGain` · `setChord(tones)`).
  복붙하면 깨짐 = 채택률 1순위 킬러.

## 목표 구조

```
demo/src/
  main.ts               히어로(tape) + 기존 3 섹션 마운트
  sections/
    tape.ts   (신규)    "Play the Tape" — 전 엔진 합주 제너러티브 트랙 + 코드 토글
    wall.ts / drumkit.ts / bass.ts   (기존, "Try each engine")
  style.css             히어로 + 코드 블록 스타일
demo/index.html         히어로 섹션 + "Try each engine" 그룹 헤딩

packages/synth-kit/README.md   Quickstart를 실제 API로 수정 + 라이브 데모 링크
```

## 트랙 설계 (tape.ts)

- BPM 84, 16th step = `60/84/4`. 패턴 길이 64 step(4마디, 16 step/마디).
- 코드 진행(마디당 1코드): **Am → F → C → G** (i-VI-III-VII, wall-of-sound 정석).
  각 코드는 wall이 받는 4톤(root·3rd·5th·octave).
- 배선(§7 mix discipline 준수):
  ```
  master(gain) → limiter(DynamicsCompressor) → destination
  wall  → strip(carve: hp120 + bell 300Hz -2dB, gain 0.9) → master   // sustained → 패닝/carve OK
  drums → master                                                     // transient → mono 직결
  bass  → master
  ```
- 시퀀서(`runStepClock` onStep):
  - `stepInBar === 0` → `wall.setChord(CHORDS[bar])` (마디마다 글라이드).
  - drums는 절대 stepIdx ≥ 32(2마디 인트로 후) 진입: kick 1·3, snare(gated) 2·4, 8th 클로즈 햇 + 오픈 햇.
  - bass sub는 step 0부터 드론: 마디 0·8 step에서 코드 root 저역, 반마디 서스테인.
  - wall 게인은 시작 시 0→0.8 4초 페이드인(1회). 정지 시 0으로 램프.
- 루프: `totalSteps` 크게, 패턴은 `stepIdx % 64`. 인트로 페이드는 절대 stepIdx로 1회만.

## 체크리스트

### 단계별 항목
- [x] 1. spec 작성
- [x] 2. `demo/src/sections/tape.ts` — 트랙 + 코드 토글
- [x] 3. `demo/index.html` — 히어로 + 그룹 헤딩
- [x] 4. `demo/src/style.css` — 히어로/코드 블록 스타일
- [x] 5. `demo/src/main.ts` — tape 마운트
- [x] 6. README Quickstart 실제 API로 수정 + 라이브 데모 링크 (`update()` 오기도 정정)
- [x] 7. `pnpm build` → `pnpm --filter demo check:type` → `pnpm lint:fix` + `vite build` 통과
- [ ] 8. (사용자 확인 후) `pnpm --filter demo deploy` — synth-kit.coldsurf.io

## 변경 범위 요약

| 파일 | 변경 |
|------|------|
| `demo/src/sections/tape.ts` | 신규 — 전 엔진 합주 트랙 + show-the-code |
| `demo/index.html` | 히어로 섹션 + "Try each engine" 헤딩 |
| `demo/src/style.css` | 히어로/코드 블록 스타일 |
| `demo/src/main.ts` | tape 섹션 마운트 |
| `packages/synth-kit/README.md` | Quickstart 실제 API 수정 + 데모 링크 |
