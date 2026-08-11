import { describe, it, expect } from 'vitest'
import { ICONS, ICON_VIEWBOX, iconScale } from './icons'
import type { ButtonId } from '../input/button'

const IDS: ButtonId[] = ['attack', 'roll', 'magic']

describe('icons', () => {
  it('has artwork for every button', () => {
    for (const id of IDS) expect(ICONS[id]).toBeDefined()
  })

  it('stores real SVG path data', () => {
    for (const id of IDS) {
      const icon = ICONS[id]!
      expect(icon.path.length).toBeGreaterThan(100)
      expect(icon.path.trimStart().startsWith('M')).toBe(true)
    }
  })

  it('credits each icon, as CC BY 3.0 requires', () => {
    for (const id of IDS) {
      expect(ICONS[id]!.author.length).toBeGreaterThan(0)
      expect(ICONS[id]!.name.length).toBeGreaterThan(0)
    }
  })

  it('uses the game-icons 512 viewBox', () => {
    expect(ICON_VIEWBOX).toBe(512)
  })

  it('scales a 512 icon down to the requested pixel size', () => {
    expect(iconScale(51.2)).toBeCloseTo(0.1)
    expect(iconScale(512)).toBeCloseTo(1)
  })
})
