import {
  BATHEDAY_KIT,
  createDrumKit,
  DRY_KIT,
  type DrumKitHandle,
  type DrumKitPreset,
  DUB_HOLY_KIT,
  DUB_POWER_KIT,
  DUB_RELAY_KIT,
  IRON_KIT,
  REVEAL_KIT,
  SUBLIME_KIT,
  WET_KIT,
} from '@coldsurf/synth-kit/drumkit'

const PRESETS: Record<string, DrumKitPreset> = {
  DRY_KIT,
  WET_KIT,
  IRON_KIT,
  BATHEDAY_KIT,
  SUBLIME_KIT,
  REVEAL_KIT,
  DUB_RELAY_KIT,
  DUB_HOLY_KIT,
  DUB_POWER_KIT,
}

export function mountDrumkitSection(container: HTMLElement) {
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

  const kickButton = makePadButton('Kick')
  const snareButton = makePadButton('Snare')
  const hatClosedButton = makePadButton('Hat (Closed)')
  const hatOpenButton = makePadButton('Hat (Open)')
  pads.append(kickButton, snareButton, hatClosedButton, hatOpenButton)

  container.append(controls, pads)

  let ctx: AudioContext | null = null
  let kit: DrumKitHandle | null = null

  const ensureKit = (): { ctx: AudioContext; kit: DrumKitHandle } => {
    ctx ??= new AudioContext()
    kit ??= createDrumKit(ctx, ctx.destination, PRESETS[select.value])
    return { ctx, kit }
  }

  select.addEventListener('change', () => {
    kit?.dispose()
    kit = ctx ? createDrumKit(ctx, ctx.destination, PRESETS[select.value]) : null
  })

  kickButton.addEventListener('click', () => {
    const { ctx, kit } = ensureKit()
    kit.kick(ctx.currentTime, 0.9)
  })
  snareButton.addEventListener('click', () => {
    const { ctx, kit } = ensureKit()
    kit.snare(ctx.currentTime, 0.8)
  })
  hatClosedButton.addEventListener('click', () => {
    const { ctx, kit } = ensureKit()
    kit.hat(ctx.currentTime, 0.7, false)
  })
  hatOpenButton.addEventListener('click', () => {
    const { ctx, kit } = ensureKit()
    kit.hat(ctx.currentTime, 0.7, true)
  })
}

function makePadButton(label: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.textContent = label
  return button
}
