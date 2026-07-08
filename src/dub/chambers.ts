/**
 * Dub chamber presets — *챔버 패치*. 트랙당 하나. 각 dub 트랙 인라인 마스터/믹스 챔버의 *들리는
 * 상수* 를 그대로 옮긴 것이라, 거의 같아 보여도 합치지 않는다 — *소리 보존* 이 기준.
 * dedup 이득은 엔진(`createDubChamber`)이지 preset 수가 아니다.
 *
 * delay time 은 *BPM 의 점음 8분/4분* 이라 트랙마다 다르다(144 / 70 / 78 BPM).
 */

import type { DubChamberPreset } from './chamber'

/** dub-relay — 144 BPM. 얕은 duck(0.7, 베이스 *지속 압력*) + 짧은 313 ms echo. */
export const DUB_RELAY_CHAMBER: DubChamberPreset = {
  master: { lowpassHz: 12000, satDrive: 2.4 },
  fade: { inSec: 2.5, outLeadSec: 8 },
  duck: { min: 0.7, attackSec: 0.018, recoverSec: 0.22 },
  delay: {
    maxSec: 1.0,
    timeL: 0.3125, // dotted 8th @ 144 BPM
    timeR: 0.4167, // quarter
    feedback: 0.55,
    hpHz: 220,
    lpHz: 1800,
    returnGain: 0.9,
  },
}

/** dub-holy — 70 BPM half-time. *깊고 긴* duck(0.55 / 0.45 s) + 643 ms 두꺼운 echo. */
export const DUB_HOLY_CHAMBER: DubChamberPreset = {
  master: { lowpassHz: 14000, satDrive: 2.0 },
  fade: { inSec: 4.0, outLeadSec: 10 },
  duck: { min: 0.55, attackSec: 0.02, recoverSec: 0.45 },
  delay: {
    maxSec: 2.0,
    timeL: 0.6429, // dotted 8th @ 70 BPM
    timeR: 0.857, // quarter
    feedback: 0.62,
    hpHz: 180,
    lpHz: 1500,
    returnGain: 1.1, // dub-relay 0.9 보다 두껍게
  },
}

/** dub-power — 78 BPM. 깊고 긴 duck(0.55 / 0.32 s) + 577 ms *권위의 잔향*. */
export const DUB_POWER_CHAMBER: DubChamberPreset = {
  master: { lowpassHz: 12000, satDrive: 2.2 },
  fade: { inSec: 3.0, outLeadSec: 10 },
  duck: { min: 0.55, attackSec: 0.022, recoverSec: 0.32 },
  delay: {
    maxSec: 1.5,
    timeL: 0.5769, // dotted 8th @ 78 BPM
    timeR: 0.7692, // quarter
    feedback: 0.6,
    hpHz: 240,
    lpHz: 2000,
    returnGain: 0.95,
  },
}

/**
 * crush(22) — 66 BPM sludge. *세 엔진 동시 최대치* 의 마스터(벽 크레셴도 + 쇠 박 + 덥 잔향).
 * 가장 거친 saturation(2.6) + 가장 어두운 LP(8000) — 검은 벽의 거친 고역을 한 겹 더 깎는다.
 * duck 은 얕게(0.6) — *쇠* kick 이 벽을 뚫되 벽을 무너뜨리진 않게. 682 ms *짓누르는* dub tail.
 */
export const CRUSH_CHAMBER: DubChamberPreset = {
  master: { lowpassHz: 8000, satDrive: 2.6 },
  fade: { inSec: 4.0, outLeadSec: 12 },
  duck: { min: 0.6, attackSec: 0.02, recoverSec: 0.3 },
  delay: {
    maxSec: 2.0,
    timeL: 0.6818, // dotted 8th @ 66 BPM
    timeR: 0.9091, // quarter
    feedback: 0.6,
    hpHz: 200,
    lpHz: 1600,
    returnGain: 1.0,
  },
}
