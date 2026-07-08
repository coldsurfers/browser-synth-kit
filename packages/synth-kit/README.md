# @coldsurf/synth-kit

Color-blind Web Audio synthesis engines, built for [COLDSURF Tape](https://coldsurf.io) — a generative music series produced entirely from code, no samples, no external audio.

## Mental model

Think VST: **one engine, many patches.**

- An **engine** (`createWall`, `createDrumKit`, `createBass`, `createDubChamber`, `createStrip`) knows nothing about "sound." It only accepts parameters.
- A **preset** is the color — a plain object of parameter values (`SUNWALL`, `BLUEWALL`, `DRY_KIT`, `DUB_HOLY_BASS`, ...).
- Every engine takes an `AudioContext` and a `bus: AudioNode` it connects into — nothing else. Compose engines by wiring their outputs into shared buses, channel strips, or a dub chamber.

```ts
import { createWall, SUNWALL, runStepClock } from '@coldsurf/synth-kit'

const ctx = new AudioContext()
const wall = createWall(ctx, ctx.destination, SUNWALL)

wall.fadeIn(0.8, 2)
wall.setChord(0)

// drive the time-varying parts (distortion ramp, tremolo depth) from your own clock
runStepClock(ctx, {
  start: ctx.currentTime + 0.1,
  step: 60 / 88 / 4, // 16th notes at 88 BPM
  totalSteps: 64,
  onStep: (_stepIdx, when) => {
    wall.update(when - ctx.currentTime)
  },
})
```

## Engines

| Engine | Import | Vocabulary | Built-in presets |
| --- | --- | --- | --- |
| Wall | `createWall` | sawtooth chord stack → WaveShaper distortion → tremolo LFO. Shoegaze/blackgaze/post-rock/post-metal walls. | `SUNWALL` · `BLUEWALL` · `WHITEWALL` · `BLACKWALL` · `SUBLIME_HATE_WALL` · `GRATIS_WALL` |
| Drumkit | `createDrumKit` (`./drumkit`) | kick (pitched body + optional sub/click) · snare (tone + noise, optional gated tails) · hat (filtered noise, open/closed). | `DRY_KIT` · `WET_KIT` · `IRON_KIT` · `BATHEDAY_KIT` · `SUBLIME_KIT` · `REVEAL_KIT` · `DUB_RELAY_KIT` · `DUB_HOLY_KIT` · `DUB_POWER_KIT` |
| Bass | `createBass` (`./bass`) | reese + sub layers. | `DUB_RELAY_BASS` · `DUB_HOLY_BASS` · `DUB_POWER_BASS` |
| Dub chamber | `createDubChamber` (`./dub`) | sidechain duck bus + cross-feedback stereo delay return + tape saturation → master. | `DUB_RELAY_CHAMBER` · `DUB_HOLY_CHAMBER` · `DUB_POWER_CHAMBER` · `CRUSH_CHAMBER` |
| Space | `createStrip` (`./space`) | per-instrument channel strip — pan + carve EQ (HP/LP/bell), opt-in only. | — (mixer, not an instrument) |
| Scheduler | `runStepClock` | color-blind lookahead step clock (`AudioContext.currentTime` based, no `setInterval` jitter). | — |

All engine handles expose `dispose()`. Instrument engines that hold time-varying parameters (wall's distortion/tremolo ramps) expose `update(elapsedSec)` — call it from your own clock (e.g. `runStepClock`).

## Design invariants

- **Zero runtime dependencies.** Pure Web Audio API + TypeScript.
- **Single-entry barrels.** Import from the package root or its `./drumkit` / `./bass` / `./dub` / `./space` subpaths only — no deep imports into internal files.
- **Engines never own scheduling, master fades, sidechain, or panning.** Those are the caller's responsibility — engines only build the node graph and expose handles.
- **Presets never merge "close enough" values.** Two presets that look nearly identical (e.g. two kick bodies 3 Hz apart) stay separate constants — the goal is preserving an exact, previously-shipped sound, not deduplicating numbers.

## Browser vs. offline rendering

This package is built and tested against real browser `AudioContext`. It does **not** currently ship an offline-rendering runtime.

If you plan to render score/patterns to a `.wav` file outside a browser (e.g. from a CLI or server process), be aware: some engines' time-varying parameters (the `wall` engine's distortion envelope, specifically) reassign `WaveShaperNode.curve` at runtime, which real browsers allow but [`node-web-audio-api`](https://github.com/ircam-ircam/node-web-audio-api) currently does not. Presets with a static (non-ramping) distortion value, and all `drumkit`/`bass`/`dub` engines, are unaffected. A dedicated offline-rendering story (headless-browser based, or an engine-level fix) is tracked separately — see the issues tab.

## License

MIT
