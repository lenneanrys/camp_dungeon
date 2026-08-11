import { describe, it, expect } from 'vitest'
import { PALETTE, MATERIALS, tint } from './palette'
import type { Material } from './palette'

describe('palette', () => {
  it('defines every material the village needs', () => {
    const needed: Material[] = [
      'timber',
      'timberDark',
      'plaster',
      'thatch',
      'roofTile',
      'roofBlue',
      'stone',
      'cobble',
      'grass',
      'dirt',
      'iron',
      'copper',
      'glass',
      'straw',
      'cloth',
      'clothAlt',
      'rope',
      'leaf',
    ]
    for (const m of needed) expect(PALETTE[m]).toBeDefined()
  })

  it('uses valid hex colours throughout', () => {
    for (const colour of Object.values(PALETTE)) {
      expect(colour).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  // Two materials that render identically are two materials the player cannot
  // tell apart — which is the whole reason the village would read as mush.
  it('gives every material a distinct colour', () => {
    const seen = new Map<string, string>()
    for (const [name, colour] of Object.entries(PALETTE)) {
      expect(seen.has(colour), `${name} duplicates ${seen.get(colour)}`).toBe(false)
      seen.set(colour, name)
    }
  })

  it('lists every material in MATERIALS', () => {
    expect(MATERIALS.length).toBe(Object.keys(PALETTE).length)
    for (const m of MATERIALS) expect(PALETTE[m]).toBeDefined()
  })
})

describe('tint', () => {
  // Per-tile variation is what stops a grass field looking like a checkerboard.
  it('leaves a colour alone at zero', () => {
    expect(tint(PALETTE.grass, 0)).toBe(PALETTE.grass)
  })

  it('lightens on positive and darkens on negative', () => {
    const value = (hex: string) => parseInt(hex.slice(1, 3), 16)
    expect(value(tint(PALETTE.grass, 0.2))).toBeGreaterThan(value(PALETTE.grass))
    expect(value(tint(PALETTE.grass, -0.2))).toBeLessThan(value(PALETTE.grass))
  })

  it('always returns a valid hex colour', () => {
    for (const amount of [-1, -0.5, 0, 0.5, 1]) {
      expect(tint(PALETTE.grass, amount)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('clamps rather than wrapping at the extremes', () => {
    expect(tint('#ffffff', 1)).toBe('#ffffff')
    expect(tint('#000000', -1)).toBe('#000000')
  })
})
