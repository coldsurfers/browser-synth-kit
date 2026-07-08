/**
 * Space — *공간/믹스* 어휘의 공유 도구(per-instrument 채널 스트립: 패닝 + carve EQ). 단일 진입 배럴.
 *
 * 소비 코드는 *오직 이 배럴* 로만 import — deep import 는 지원 대상이 아니다. space 는 *악기가
 * 아니라 믹서* 지만 같은 *주입된 `AudioNode` bus* seam 위에 올라가므로 같은 버킷에 둔다.
 */

export { createStrip, type StripHandle, type StripPreset } from './strip'
