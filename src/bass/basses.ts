/**
 * Bass presets — *bass 패치*. 트랙당 하나. 각 dub 트랙 인라인 베이스의 *들리는 상수* 를 그대로
 * 옮긴 것이라, 거의 같아 보여도(예: relay lp380/Q6 vs power lp420/Q5.5) 합치지 않는다 —
 * *소리 보존* 이 기준. dedup 이득은 엔진(`createBass`)이지 preset 수가 아니다.
 *
 * dub-holy 는 reese 없이 sub 만 — *대성당의 드론* 은 sustained sub + organ pad 가 핵이라
 * reese 의 *우글거림* 을 쓰지 않는다.
 */

import type { BassPreset } from './bass'

/** Dub the Wall(21) — *둥둥둥* 의 잔음. relay 의 sub(38–55 Hz)·reese(Berghain 결). */
export const DUB_RELAY_BASS: BassPreset = {
  sub: { secondType: 'triangle', attack: 0.04, release: 0.12 },
  reese: { detuneCents: 8, lpHz: 380, lpQ: 6, satK: 3.5, attack: 0.012, release: 0.05 },
}

/** Dub Holy(20) — *대성당의 sub 드론*. 60–120 Hz, 보조 osc 살짝 detune(맥놀이). reese 없음. */
export const DUB_HOLY_BASS: BassPreset = {
  sub: { secondType: 'triangle', secondRatio: 1.005, attack: 0.08, release: 0.2 },
}

/** Dub Power(22) — *peak 64.6 Hz* 의 sub + *권위의 우글거림* reese. */
export const DUB_POWER_BASS: BassPreset = {
  sub: { secondType: 'triangle', attack: 0.05, release: 0.15 },
  reese: { detuneCents: 10, lpHz: 420, lpQ: 5.5, satK: 3.2, attack: 0.015, release: 0.06 },
}
