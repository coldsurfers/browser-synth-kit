# synth-kit 런칭 키트

라이브 데모(**https://synth-kit.coldsurf.io**)가 유일한 공유 자산이다.
배포 후 아래 문안으로 채널별로 돌린다. 후크는 항상 하나: **"샘플 0개, 코드만으로 한 곡."**

## 배포 전 체크

- [ ] `pnpm --filter demo dev` 로 트랙 소리 확인 (preset/velocity 튜닝)
- [ ] `pnpm --filter demo deploy` → synth-kit.coldsurf.io
- [ ] 화면녹화 GIF 1개 (트랙 재생 → "show the code" 토글, 6~10초) — 소셜 첨부용
- [ ] README에 npm version · zero-deps 배지 (선택)

## Show HN

**Title**
```
Show HN: A whole shoegaze track from ~40 lines of Web Audio, no samples
```

**Body**
```
synth-kit is a set of "color-blind" Web Audio engines behind a VST-style
engine/preset model — one engine, many patches. An engine (createWall,
createDrumKit, createBass, ...) never decides *what* or *when* to play; you
feed it a plain preset object and own the scheduling.

The live demo plays a full generative track — wall + drums + bass + mixer
strip + a lookahead step clock, all wired into one master — and shows the
exact ~40 lines that produced it. Zero runtime dependencies, MIT, browser-first.

Live: https://synth-kit.coldsurf.io
Code: https://github.com/coldsurfers/browser-synth-kit
npm:  @coldsurf/synth-kit

Happy to talk about the engine/preset split and why scheduling lives in the
caller, not the engine.
```

## X / Threads (GIF 첨부)

**KR**
```
코드 ~40줄로 슈게이즈 트랙 한 곡. 샘플 0개, 전부 Web Audio.

▶ synth-kit.coldsurf.io — 재생하고 "show the code" 눌러보세요.
엔진/프리셋 = VST 모델. 스케줄링은 호출자가 소유.

pnpm add @coldsurf/synth-kit
```

**EN**
```
A whole shoegaze track from ~40 lines of Web Audio. No samples.

▶ synth-kit.coldsurf.io — hit play, then "show the code".
VST-style engine/preset split, zero deps, MIT.

pnpm add @coldsurf/synth-kit
```

## Reddit — r/webaudio, r/typescript, r/javascript

**Title**
```
[Show] synth-kit — VST-style Web Audio engines (zero-deps, MIT): a full track from ~40 lines
```

**Body**
```
Built for a generative music series (COLDSURF Tape). Engine/preset model:
the engine builds a node graph and hands back a handle; you own scheduling,
mixing, and lifecycle. Wall / drumkit / bass / dub chamber / mixer strip +
a color-blind lookahead step clock.

The demo wires every engine into one shoegaze track and shows the code:
https://synth-kit.coldsurf.io

Feedback on the API surface welcome.
```

## 추가 레버리지 (여유 될 때)

- README 배지: npm version, bundlephobia zero-deps, MIT.
- 화면녹화 GIF를 README 최상단에 삽입 (텍스트보다 강함).
- `awesome-webaudio` 리스트에 PR.
- 각 built-in preset을 짧은 오디오 클립으로 → 프리셋 갤러리 페이지(2차 확장).
- dev.to / 블로그: "왜 스케줄링을 엔진 밖에 두는가" — 설계 서사 1편.

## 채널 우선순위 (글로벌)

1. Show HN (설계 서사가 먹히는 곳 — 가장 높은 신호)
2. r/webaudio (정확한 타깃 오디언스)
3. X/Threads (GIF로 시각적 후크)
4. r/typescript · r/javascript (지원 사격)

---

# 한국 커뮤니티

한국판 Show HN = **긱뉴스(GeekNews)**. 운영 방식(링크 + 짧은 소개 + "소개하는 이유")도
비슷해 담백한 톤이 잘 통한다. "코드로 음악"이라는 청각/비주얼 후크가 특히 잘 먹히므로
GIF(재생 → show the code) 첨부가 페북·카톡방에서 결정적.

## 채널 우선순위 (한국)

| 채널 | 성격 | 대응 |
|------|------|------|
| **긱뉴스 (news.hada.io)** | 한국판 HN. 직접 만든 것 공유, 설계 서사 먹힘 | Show HN 1:1 |
| **요즘IT (yozm.wishket)** | 기고형 — "왜 스케줄링을 엔진 밖에 뒀나" 1편 | 서사용 |
| **페이스북 그룹** — JavaScript Korea, 프론트엔드 개발그룹 | 링크 + GIF | 시각 후크 |
| **OKKY / 커리어리** | 프로젝트 소개 피드 | 보조 |
| **카톡·디스코드** — React Korea, 프론트엔드 오픈채팅 | GIF 던지기 | 확산 |
| **velog** | 데모 링크 + 만든 과정, 트렌딩 노림 | 서사용 |

## 긱뉴스 초안

**제목**
```
synth-kit — 샘플 0개, 코드 ~40줄로 슈게이즈 한 곡 (Web Audio, zero-deps)
```

**본문 / 소개**
```
브라우저 Web Audio 신스 엔진 모음입니다. VST 모델을 코드로 옮겼어요 —
엔진(createWall, createDrumKit, createBass…)은 "무엇을/언제" 연주할지 모릅니다.
평범한 preset 객체만 받고, 스케줄링·믹싱·라이프사이클은 호출자가 소유합니다.

라이브 데모는 wall + drums + bass + mixer + 스텝 클럭을 한 트랙으로 엮은
슈게이즈 곡을 재생하고, 그걸 만든 실제 코드 ~40줄을 바로 보여줍니다.
런타임 의존성 0개, MIT.

▶ 데모: https://synth-kit.coldsurf.io
- 코드: https://github.com/coldsurfers/browser-synth-kit
- npm: @coldsurf/synth-kit
```

**첫 댓글로 붙일 배경** (긱뉴스·HN 공통 팁 — 반응 좋아짐)
```
왜 스케줄링을 엔진 안에 안 넣었는지, engine/preset을 나눈 이유를 적어두면
토론이 붙는다. "한 엔진, 여러 패치" 한 줄 + 짧은 근거.
```
