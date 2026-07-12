import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'drumkit/index': 'src/drumkit/index.ts',
    'bass/index': 'src/bass/index.ts',
    'dub/index': 'src/dub/index.ts',
    'space/index': 'src/space/index.ts',
    'visual/index': 'src/visual/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
})
