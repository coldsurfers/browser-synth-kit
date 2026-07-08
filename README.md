# browser-synth-kit

Monorepo for [`@coldsurf/synth-kit`](./packages/synth-kit) — color-blind Web Audio synthesis engines built for [COLDSURF Tape](https://coldsurf.io), a generative music series produced entirely from code, no samples, no external audio.

```
packages/synth-kit/   the published package (@coldsurf/synth-kit) — engines, presets, scheduler
demo/                 Vite + vanilla TS playground — pick an engine + preset, hit play
```

For the engine/preset mental model, usage examples, and the offline-rendering caveat, see [`packages/synth-kit/README.md`](./packages/synth-kit/README.md). For coding-agent-facing signatures and lifecycle rules, see [`AGENTS.md`](./AGENTS.md).

## Working in this repo

```bash
pnpm install
pnpm build              # build the library (packages/synth-kit → dist/)
pnpm --filter demo dev  # run the demo playground (needs the library built first)
pnpm check:type         # typecheck both workspace members
pnpm lint:fix           # biome check --write ., single root biome.json
```

## License

MIT
