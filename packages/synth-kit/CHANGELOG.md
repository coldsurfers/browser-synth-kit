# @coldsurf/synth-kit

## 0.2.0

### Minor Changes

- f269733: feat(visual): add `@coldsurf/synth-kit/visual` — frame-synced generative backdrop for VJ / installation use

  New color-blind visual engine mirroring the audio side. Two interchangeable renderers behind one `VisualStageHandle`: `createVisualStage` (2D canvas, universal) and `createGlStage` (WebGL2 "wall of light" — ping-pong feedback smear + soft bloom + chromatic aberration + film grain). `createVisualSync(ctx, stage)` bridges `runStepClock.onStep` to either renderer while absorbing the scheduler's lookahead (flashes land with the sound, not ~100ms early). Ships mood-matched stage presets `SUN_STAGE` / `BLACK_STAGE` / `BLUE_STAGE` / `HATE_STAGE` (with optional GL art knobs `warp` / `grain` / `feedback`).

## 0.1.2

### Patch Changes

- dcf53e2: Fix README quickstart to match the real API (`createWall` takes `initialTones`; drive time-varying parts via `rampGain`/`setChord`, not the non-existent `update()`/`fadeIn()`), and add a live demo link (synth-kit.coldsurf.io).

## 0.1.1

### Patch Changes

- 01003c7: Add `.npmrc` (scoped registry + pinned pnpm version) and set up changesets for release notes. No runtime or public API change.
