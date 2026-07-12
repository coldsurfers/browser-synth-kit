# Noise — standalone masking-noise section (demo)

## 목표
음악(synth-kit) + notch를 엮지 않고, **튜닝 가능한 masking 노이즈**만 단독 섹션으로 뽑는다.
violet noise(고역 +6dB/oct, "Ten Hours of Violet Noise" 느낌)를 bandpass 하나로 다듬고,
주파수·집중도(Q)·레벨을 실시간으로 조절한다. 스펙트럼으로 노이즈 밴드 + 내 주파수 마커를 본다.

> ⚠️ 교육/데모용, 의료기기 아님. 볼륨 안전(순음 캡 0.06, 레벨 캡 0.25) + 경고.

## 이력 (pivot)
- 초기: `tinnitus.ts` — 음악(notch, TMNMT) + masker 결합 섹션.
- 사용자 요청으로 **음악을 떼고 노이즈만** 단독 섹션(`noise.ts`)으로 재구성. `tinnitus.ts` 삭제,
  `.tinnitus-*` → `.noise-*`, `#tinnitus-section` → `#noise-section`.

## 목표 구조
```
demo/src/sections/noise.ts   ← 신규 (이 섹션의 전부)
demo/src/main.ts             ← mountNoiseSection 등록
demo/index.html              ← <section id="noise-section">
demo/src/style.css           ← .noise-* 스타일
```

### 오디오 그래프
```
violet noise → bandpass(freq = pitch, Q = focus) → level(gain) → analyser → limiter → master → out
tone(sine @ pitch) → toneGain(≤0.06) → master → out
```
- `master` = 섹션 전체 볼륨 GainNode(노이즈 + 순음 공용). ensureCtx()에서 1회 생성.
- violet noise = white noise 1차 차분(미분 = +6dB/oct), 2s 결정론적 루프, 정규화.
- bandpass 하나로 "집중도" 표현: Q 낮음 = 넓은 airy 배드, Q 높음 = 그 주파수에 좁게 모인 hiss.
- pitch 슬라이더가 bandpass·tone·마커를 동시에 이동.

### UI
```
재생         [▶ Play] [▶ 순음 듣기]
볼륨          [슬라이더]              70%   ← 마스터 (노이즈+순음)
주파수       [슬라이더 500Hz–12kHz]  6.00 kHz
노이즈 집중   [슬라이더 넓게↔좁게]     Q 3.8
노이즈 레벨   [슬라이더]              48%   ← 밴드 세기
[스펙트럼: 노이즈 밴드 + fT 마커]
disclaimer
```

## 체크리스트
- [x] `noise.ts` — violet noise + bandpass(pitch/focus) + level + tone + 스펙트럼
- [x] `tinnitus.ts` 삭제, main.ts/index.html/style.css 재배선(noise-*)
- [x] biome ✅ / `check:type` ✅ / `build` ✅

## 변경 범위 요약
| 파일 | 변경 |
|------|------|
| `demo/src/sections/noise.ts` | 신규 — 노이즈 단독 섹션 |
| `demo/src/sections/tinnitus.ts` | 삭제 (음악+notch 결합 섹션) |
| `demo/src/main.ts` | mountNoiseSection 등록 |
| `demo/index.html` | `#noise-section` |
| `demo/src/style.css` | `.noise-*` |
