# AGENTS.md

Guidance for coding agents (Claude Code, Cursor, etc.) working with `@coldsurf/synth-kit`. This file is about **how not to get it wrong** — for what the package is, read [README.md](./README.md) first.

Two audiences share this file:

- **§0** is for agents working *inside this repo* (adding engines, presets, fixing bugs, publishing).
- **§1 onward** is the contract for agents *consuming* the package from a host project — the mental model, engine signatures, and lifecycle rules apply identically whether you're calling `createWall` from this repo's own code or from an app that depends on it.

## 0. Working in this repo

This is a pnpm workspace monorepo with two members:

```
packages/synth-kit/   the published package (@coldsurf/synth-kit) — engines live here
demo/                 Vite + vanilla TS playground, depends on synth-kit via workspace:*
```

Run scripts from the repo root; `--filter` targets one workspace member.

### Commands

```bash
pnpm install                                    # once, from repo root

pnpm build                                      # = pnpm --filter @coldsurf/synth-kit build (tsup → dist/)
pnpm --filter @coldsurf/synth-kit check:type     # tsc --noEmit for the library
pnpm --filter demo dev                          # Vite dev server for the demo playground
pnpm --filter demo check:type                   # tsc --noEmit for the demo

pnpm check:type                                 # both packages (pnpm -r check:type)
pnpm lint                                        # biome check . (single root biome.json, whole repo)
pnpm lint:fix                                    # biome check --write .
```

Run `pnpm lint:fix` and `pnpm check:type` after any edit, before considering a change done. The demo imports the library's built `dist/` output (via its `exports` map, resolved through the workspace symlink) — rebuild the library (`pnpm build`) after engine/preset changes before expecting the demo to pick them up.

### Architecture map

```
packages/synth-kit/src/
  index.ts        root barrel — wall (sunwall.ts) + scheduler + space re-exports
  sunwall.ts       Wall engine (createWall) + built-in wall presets
  scheduler.ts     runStepClock — the only scheduling primitive
  drumkit/         createDrumKit (drumkit.ts) + presets (kits.ts) + barrel (index.ts)
  bass/            createBass (bass.ts) + presets (basses.ts) + barrel (index.ts)
  dub/             createDubChamber (chamber.ts) + presets (chambers.ts) + barrel (index.ts)
  space/           createStrip (strip.ts) — mixer, not an instrument

demo/src/           Vite playground — one section module per engine (wall/drumkit/bass),
                     imports @coldsurf/synth-kit exactly like an external consumer would.
```

Each subfolder's `index.ts` is the *only* supported import path for that engine (`./drumkit`, `./bass`, `./dub`, `./space`) — matches `exports` in `package.json` and entries in `tsup.config.ts`. New engine → new subfolder with the same `<engine>.ts` + `<engine>s.ts` (presets) + `index.ts` shape; new preset → new exported constant in the existing `<engine>s.ts`, not a new file.

### Code style (Biome, `biome.json`)

Single quotes, semicolons as-needed (omitted unless required), trailing commas everywhere, 2-space indent, 100-char lines, `recommended` lint preset. No `any` without a comment explaining why. Prefer explicit types over inference for exported signatures (`WallHandle`, `*Preset`, etc.) since those are the public API surface.

### Publish flow

Add a changeset for any change to the published surface: `pnpm changeset` (pick patch/minor/major, write the summary), commit the generated `.changeset/*.md` alongside your change. `pnpm version` (`changeset version`) consumes pending changesets to bump `package.json` and write `CHANGELOG.md` — run that as its own step, not mixed into a feature commit. `prepublishOnly` runs `pnpm build` automatically, so `npm publish` (or `pnpm publish`) from a clean tree after versioning is enough. Commit messages in this repo follow plain English Conventional Commits (`feat:`, `fix:`, ...), not the Korean `<type>(<scope>): ...` convention used in the `billets` monorepo.

## 1. Mental model (read this before writing any code)

VST, not framework: **one engine, many patches.**

- An **engine** (`createWall`, `createDrumKit`, `createBass`, `createDubChamber`, `createStrip`) is color-blind. It takes an `AudioContext`, an `AudioNode` bus to connect into, and a plain preset object. It never schedules anything, never decides *when* something plays.
- A **preset** is the color — a plain object of parameter values. Built-in presets (`SUNWALL`, `BLUEWALL`, `DRY_KIT`, `DUB_HOLY_BASS`, ...) are just exported constants of the engine's preset type. Writing a new sound almost always means writing a new preset object, not touching engine code.
- **The caller (you) owns scheduling, mixing, and lifecycle.** Engines only build a node graph and hand back a handle. Nothing here calls `setInterval`, decides pan, or manages sidechain — see §5 and §6.

If you're about to add a `switch` on "which song is this" inside an engine file, stop — that belongs in a preset or in your own sequencer, not in the engine.

## 2. Engine signatures (copy-paste reference)

### Wall — `createWall` (root export)

```ts
function createWall(
  ctx: AudioContext,
  bus: AudioNode,
  preset: WallPreset,
  initialTones: number[], // 4 chord tones (root · 3rd · 5th · octave), as frequencies in Hz
): WallHandle

interface WallHandle {
  setChord(tones: number[]): void
  setDistortion(amount: number): void            // reassigns WaveShaper.curve — browser only, see §7
  setTremDepth(value: number, rampSec: number): void
  setBendDepth(cents: number, rampSec: number): void
  rampGain(target: number, rampSec: number): void
  stop(): void      // stop all oscillators (idempotent)
  dispose(): void   // stop() + disconnect everything
}
```

Built-in presets: `SUNWALL` · `BLUEWALL` · `WHITEWALL` · `BLACKWALL` · `SUBLIME_HATE_WALL` · `GRATIS_WALL`.

### Drumkit — `createDrumKit` (from `@coldsurf/synth-kit/drumkit`)

```ts
function createDrumKit(ctx: AudioContext, bus: AudioNode, preset: DrumKitPreset): DrumKitHandle

interface DrumKitHandle {
  kick(when: number, velocity: number): void
  snare(when: number, velocity: number): void       // no-op if preset.snare is absent
  hat(when: number, velocity: number, open: boolean): void  // no-op if preset.hat is absent
  dispose(): void
}
```

Built-in presets: `DRY_KIT` · `WET_KIT` · `IRON_KIT` · `BATHEDAY_KIT` · `SUBLIME_KIT` · `REVEAL_KIT` · `DUB_RELAY_KIT` · `DUB_HOLY_KIT` · `DUB_POWER_KIT`.

### Bass — `createBass` (from `@coldsurf/synth-kit/bass`)

```ts
function createBass(ctx: AudioContext, bus: AudioNode, preset: BassPreset): BassHandle

interface BassHandle {
  sub(when: number, freq: number, dur: number, velocity: number): void    // no-op if preset.sub absent
  reese(when: number, freq: number, dur: number, velocity: number): void  // no-op if preset.reese absent
  dispose(): void
}
```

Built-in presets: `DUB_RELAY_BASS` · `DUB_HOLY_BASS` · `DUB_POWER_BASS`.

### Dub chamber — `createDubChamber` (from `@coldsurf/synth-kit/dub`)

```ts
function createDubChamber(
  ctx: AudioContext,
  destination: AudioNode, // final destination — e.g. ctx.destination
  preset: DubChamberPreset,
): DubChamber

interface DubChamber {
  readonly ductable: GainNode  // connect chord/pad/sub voices here — ducked on kick
  readonly drumBus: GainNode   // connect drum/perc voices here — bypasses ducking
  readonly dubSend: GainNode   // send amount — automate gain per-section from your sequencer
  duck(when: number): void            // call once per kick hit
  open(start: number, totalSec: number): void  // schedule master fade in/out once, at track start
  dispose(): void                     // fades out, then disconnects after 250ms
}
```

Built-in presets: `DUB_RELAY_CHAMBER` · `DUB_HOLY_CHAMBER` · `DUB_POWER_CHAMBER` · `CRUSH_CHAMBER`.

### Space (mixer, not an instrument) — `createStrip` (from `@coldsurf/synth-kit/space`)

```ts
function createStrip(ctx: AudioContext, dest: AudioNode, preset: StripPreset): StripHandle

interface StripPreset {
  pan?: number       // -1..1, default 0 (center)
  hpHz?: number; hpQ?: number   // carve HP — omit = no node created
  lpHz?: number; lpQ?: number   // carve LP — omit = no node created
  bell?: { hz: number; q: number; gainDb: number }  // omit = no node created
  gain?: number      // trim gain, default 1
}

interface StripHandle {
  readonly input: AudioNode      // engines connect their output here instead of directly to dest
  setPan(value: number, rampSec: number): void
  dispose(): void
}
```

Graph when everything is set: `input(trim gain) → [HP] → [LP] → [bell] → StereoPanner → dest`. Fields you omit don't create a node — see §5.

### Scheduler — `runStepClock` (root export)

```ts
function runStepClock(ctx: AudioContext, opts: StepClockOptions): StepClock

interface StepClockOptions {
  start: number       // absolute grid origin, e.g. ctx.currentTime + 0.1
  step: number         // seconds per step, e.g. 60 / bpm / 4 for 16th notes
  totalSteps: number
  onStep: (stepIdx: number, when: number) => void
  lookahead?: number   // default 0.1
  tickMs?: number       // default 25
}
interface StepClock { stop(): void }
```

This is the *only* scheduling primitive in the package. It doesn't know about music — it just calls `onStep(stepIdx, when)` for every step inside a rolling lookahead window. Your sequencer decides what happens at each step.

## 3. Minimal example — one engine

```ts
import { createWall, SUNWALL } from '@coldsurf/synth-kit'

const ctx = new AudioContext()
const wall = createWall(ctx, ctx.destination, SUNWALL, [220, 277, 330, 440])

wall.rampGain(0.8, 2)   // fade in over 2s
wall.setChord([220, 277, 330, 440])

// later, on teardown:
// wall.dispose()
```

## 4. Combining engines with the scheduler

```ts
import { createWall, SUNWALL, runStepClock } from '@coldsurf/synth-kit'
import { createDrumKit, DRY_KIT } from '@coldsurf/synth-kit/drumkit'

const ctx = new AudioContext()
const master = ctx.createGain()
master.connect(ctx.destination)

const wall = createWall(ctx, master, SUNWALL, [220, 277, 330, 440])
const kit = createDrumKit(ctx, master, DRY_KIT)

const bpm = 88
const clock = runStepClock(ctx, {
  start: ctx.currentTime + 0.1,
  step: 60 / bpm / 4, // 16th notes
  totalSteps: 64,
  onStep: (stepIdx, when) => {
    if (stepIdx % 4 === 0) kit.kick(when, 0.9)
    if (stepIdx % 8 === 4) kit.snare(when, 0.8)
  },
})

// teardown, in this order:
// clock.stop(); wall.dispose(); kit.dispose()
```

Wiring three+ engines into one dub chamber follows the same shape — connect `chord`/`pad`/`sub` voices to `chamber.ductable`, drums to `chamber.drumBus`, call `chamber.duck(when)` from your kick step, and `chamber.open(start, totalSec)` once at the top.

## 5. Lifecycle discipline

- **Every `create*()` call returns a handle with `dispose()`.** Call it exactly once, on teardown. Forgetting it leaks nodes; calling it twice is safe (internal cleanup is idempotent) but redundant.
- **`StepClock.stop()` is separate from engine `dispose()`.** Stop the clock first, then dispose engines — the clock has no independent audio state, but stopping it prevents new notes from firing into an engine you're about to tear down.
- **`WallHandle.update` doesn't exist as a separate call** — the time-varying setters (`setDistortion`, `setTremDepth`, `setBendDepth`) are what you call from your own clock (e.g. inside `onStep`). There's no single "tick" method; call the specific setter for whatever's changing.
- **Never call an engine's internal node graph directly.** If you find yourself importing something not exported from `.`/`./drumkit`/`./bass`/`./dub`/`./space`, stop — that's an unsupported deep import.

## 6. Preset-writing discipline

- **Sound preservation is the bar, not deduplication.** If you're tempted to merge two presets that are "basically the same" (e.g. two kick bodies 3 Hz apart), don't. Keep them as separate named constants. The goal of a preset is reproducing an exact, previously-heard sound — not minimizing the number of constants.
- **Opt-in fields mean opt-in nodes.** In `StripPreset`, an omitted `hpHz`/`lpHz`/`bell` means that filter node is never created — not created-and-bypassed. An empty `{}` preset is a trim gain + a pan-0 panner, nothing else. Only give a field when you actually want that stage to exist.
- **New sound → new preset constant, not a mutated existing one.** Engines don't have a "tweak this preset" API; presets are plain data. Copy, rename, adjust.

## 7. Mix discipline — lessons from combining engines on one bus

These apply whenever you route more than one engine (wall + drumkit + dub, etc.) into a shared `AudioNode` bus, especially one with per-channel saturation (dub chamber's tape saturation, a wall's WaveShaper) downstream.

1. **Pan only sustained material — keep transients mono.** Anything with a sharp attack (a clap, a drum hit — tens of milliseconds) that gets panned *before* a per-channel saturation stage produces a decorrelated click, because L/R asymmetry hits the saturation curve differently per channel. Sustained material (chords, pads — ramps over seconds) tolerates panning fine; it reads as width, not a glitch. Route transient voices straight to a mono bus (e.g. `chamber.drumBus`), and only pan sustained voices (through a `createStrip`).
2. **Headroom before anything else.** If a saturating stage is riding near its rail the whole time (zero headroom), *any* strip change (pan, carve EQ) will audibly change its saturation character — an "opt-in, transparent by default" strip preset stops being transparent. Trim the biggest driver of that saturation (usually the loudest sustained bus, e.g. a bass) down first (e.g. `{ gain: 0.75 }`) before layering in pan/EQ changes elsewhere.
3. **A pan-0 strip is not unity gain.** `StereoPanner` at pan 0 outputs ≈0.707 per channel (equal-power law) even with a mono input — about −3dB versus a direct connection. Perceptually transparent in normal playback, but it does reduce the drive into anything saturating downstream. If you need exact levels into a saturator, account for the 0.707 factor.
4. **Verify with a single event's per-channel waveform, not aggregate stats.** Averages (mean |L−R| over a section, RMS) can hide a single transient glitch entirely — the spike doesn't move the average enough to notice. If you suspect a click or artifact, look at the actual samples around that one moment, per channel.

## 8. Don't

- Don't deep-import internal files (`.../sunwall.ts`, `.../drumkit/drumkit.ts`, etc.) — only the barrels (`.`, `./drumkit`, `./bass`, `./dub`, `./space`) are supported.
- Don't implement scheduling, master fades, sidechain ducking, or panning *inside* an engine call site that's meant to be reusable — those are the sequencer's job, not the engine's. (Panning is `createStrip`'s job specifically — see §7.)
- Don't assume Node/offline-rendering parity with the browser — see below.

## Offline rendering — read before writing a render pipeline

This package is built and tested against real browser `AudioContext`. It ships **no** offline-rendering runtime. If your host project renders audio outside a browser (a build script, a server process), be aware: `createWall`'s time-varying distortion (`setDistortion`, used by `SUNWALL`, `SUBLIME_HATE_WALL`, `GRATIS_WALL`, `BLACKWALL`) reassigns `WaveShaperNode.curve` at runtime. Real browsers allow this; [`node-web-audio-api`](https://github.com/ircam-ircam/node-web-audio-api) currently does not, and will error or produce silent/broken output for those presets specifically. `drumkit`/`bass`/`dub` engines and static-distortion wall presets (`BLUEWALL`, `WHITEWALL`) are unaffected. If you need faithful offline rendering of every preset, render inside a real (headless) browser engine rather than a Node Web Audio reimplementation.
