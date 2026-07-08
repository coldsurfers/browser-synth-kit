import {
  BLACKWALL,
  BLUEWALL,
  createWall,
  GRATIS_WALL,
  SUBLIME_HATE_WALL,
  SUNWALL,
  type WallHandle,
  type WallPreset,
  WHITEWALL,
} from '@coldsurf/synth-kit'

const PRESETS: Record<string, WallPreset> = {
  SUNWALL,
  BLUEWALL,
  WHITEWALL,
  BLACKWALL,
  SUBLIME_HATE_WALL,
  GRATIS_WALL,
}

// root · 3rd · 5th · octave, matches the AGENTS.md minimal example
const CHORD = [220, 277.18, 329.63, 440]

export function mountWallSection(container: HTMLElement) {
  const controls = document.createElement('div')
  controls.className = 'controls'

  const select = document.createElement('select')
  for (const name of Object.keys(PRESETS)) {
    const option = document.createElement('option')
    option.value = name
    option.textContent = name
    select.append(option)
  }

  const playButton = document.createElement('button')
  playButton.className = 'primary'
  playButton.textContent = 'Play'

  const restartButton = document.createElement('button')
  restartButton.textContent = '화음 재시작'
  restartButton.disabled = true

  controls.append(select, playButton, restartButton)
  container.append(controls)

  let ctx: AudioContext | null = null
  let wall: WallHandle | null = null

  const stop = () => {
    if (!wall) return
    const handle = wall
    handle.rampGain(0, 0.3)
    setTimeout(() => handle.dispose(), 350)
    wall = null
    playButton.textContent = 'Play'
    restartButton.disabled = true
  }

  const play = () => {
    ctx ??= new AudioContext()
    wall = createWall(ctx, ctx.destination, PRESETS[select.value], CHORD)
    wall.rampGain(0.8, 0.5)
    playButton.textContent = 'Stop'
    restartButton.disabled = false
  }

  playButton.addEventListener('click', () => {
    if (wall) stop()
    else play()
  })

  restartButton.addEventListener('click', () => {
    wall?.setChord(CHORD)
  })

  select.addEventListener('change', () => {
    if (wall) stop()
  })
}
