import {
  type BassHandle,
  type BassPreset,
  createBass,
  DUB_HOLY_BASS,
  DUB_POWER_BASS,
  DUB_RELAY_BASS,
} from '@coldsurf/synth-kit/bass'

const PRESETS: Record<string, BassPreset> = {
  DUB_RELAY_BASS,
  DUB_HOLY_BASS,
  DUB_POWER_BASS,
}

const NOTE_FREQ = 55 // A1
const NOTE_DUR = 1

export function mountBassSection(container: HTMLElement) {
  const controls = document.createElement('div')
  controls.className = 'controls'

  const select = document.createElement('select')
  for (const name of Object.keys(PRESETS)) {
    const option = document.createElement('option')
    option.value = name
    option.textContent = name
    select.append(option)
  }
  controls.append(select)

  const pads = document.createElement('div')
  pads.className = 'pads'

  const subButton = document.createElement('button')
  subButton.textContent = 'Sub'
  const reeseButton = document.createElement('button')
  reeseButton.textContent = 'Reese'
  pads.append(subButton, reeseButton)

  container.append(controls, pads)

  let ctx: AudioContext | null = null
  let bass: BassHandle | null = null

  const ensureBass = (): { ctx: AudioContext; bass: BassHandle } => {
    ctx ??= new AudioContext()
    bass ??= createBass(ctx, ctx.destination, PRESETS[select.value])
    return { ctx, bass }
  }

  select.addEventListener('change', () => {
    bass?.dispose()
    bass = ctx ? createBass(ctx, ctx.destination, PRESETS[select.value]) : null
  })

  subButton.addEventListener('click', () => {
    const { ctx, bass } = ensureBass()
    bass.sub(ctx.currentTime, NOTE_FREQ, NOTE_DUR, 0.9)
  })
  reeseButton.addEventListener('click', () => {
    const { ctx, bass } = ensureBass()
    bass.reese(ctx.currentTime, NOTE_FREQ, NOTE_DUR, 0.9)
  })
}
