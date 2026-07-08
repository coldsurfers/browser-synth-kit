import { mountBassSection } from './sections/bass'
import { mountDrumkitSection } from './sections/drumkit'
import { mountWallSection } from './sections/wall'

const wallSection = document.querySelector<HTMLElement>('#wall-section')
const drumkitSection = document.querySelector<HTMLElement>('#drumkit-section')
const bassSection = document.querySelector<HTMLElement>('#bass-section')

if (wallSection) mountWallSection(wallSection)
if (drumkitSection) mountDrumkitSection(drumkitSection)
if (bassSection) mountBassSection(bassSection)
