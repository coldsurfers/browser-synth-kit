---
'@coldsurf/synth-kit': minor
---

feat(visual): add `@coldsurf/synth-kit/visual` — frame-synced generative backdrop for VJ / installation use

New color-blind visual engine mirroring the audio side. Two interchangeable renderers behind one `VisualStageHandle`: `createVisualStage` (2D canvas, universal) and `createGlStage` (WebGL2 "wall of light" — ping-pong feedback smear + soft bloom + chromatic aberration + film grain). `createVisualSync(ctx, stage)` bridges `runStepClock.onStep` to either renderer while absorbing the scheduler's lookahead (flashes land with the sound, not ~100ms early). Ships mood-matched stage presets `SUN_STAGE` / `BLACK_STAGE` / `BLUE_STAGE` / `HATE_STAGE` (with optional GL art knobs `warp` / `grain` / `feedback`).
