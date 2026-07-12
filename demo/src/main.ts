import { mountBassSection } from './sections/bass'
import { mountDrumkitSection } from './sections/drumkit'
import { mountNoiseSection } from './sections/noise'
import { mountTapeSection } from './sections/tape'
import { mountVjSection } from './sections/vj'
import { mountWallSection } from './sections/wall'

const tapeSection = document.querySelector<HTMLElement>('#tape-section')
const vjSection = document.querySelector<HTMLElement>('#vj-section')
const noiseSection = document.querySelector<HTMLElement>('#noise-section')
const wallSection = document.querySelector<HTMLElement>('#wall-section')
const drumkitSection = document.querySelector<HTMLElement>('#drumkit-section')
const bassSection = document.querySelector<HTMLElement>('#bass-section')

if (tapeSection) mountTapeSection(tapeSection)
if (vjSection) mountVjSection(vjSection)
if (noiseSection) mountNoiseSection(noiseSection)
if (wallSection) mountWallSection(wallSection)
if (drumkitSection) mountDrumkitSection(drumkitSection)
if (bassSection) mountBassSection(bassSection)
