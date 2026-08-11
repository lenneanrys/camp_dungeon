/**
 * One palette for the whole village.
 *
 * A shared, deliberately limited set of materials is the single biggest lever
 * on whether a procedurally-built village reads as a place rather than a pile
 * of boxes — buildings look related because they are literally made of the
 * same stuff.
 */
export const PALETTE = {
  timber: '#7a5433', // structural beams
  timberDark: '#4a3120', // blacksmith framing
  plaster: '#d9cdb4', // wattle-and-daub walls
  thatch: '#b99a54',
  roofTile: '#8c4131', // fired clay
  roofBlue: '#3c4d7a', // the enchanter's slate
  stone: '#8a8a86',
  cobble: '#6f6f6b',
  grass: '#4a6b32',
  dirt: '#6b5535',
  iron: '#4c5157',
  copper: '#9c6b3f',
  glass: '#7fa8b8',
  straw: '#c9a95d',
  cloth: '#a8412f', // market awnings
  clothAlt: '#e0d7c2', // the stripe between them
  rope: '#9b8253',
  leaf: '#3c5c2a',
} as const

export type Material = keyof typeof PALETTE

export const MATERIALS = Object.keys(PALETTE) as Material[]

/**
 * Lighten (positive) or darken (negative) a colour. Used for per-tile ground
 * variation, without which a tiled field reads as a checkerboard.
 */
export function tint(hex: string, amount: number): string {
  if (amount === 0) return hex
  const n = parseInt(hex.slice(1), 16)
  const channel = (shift: number): string => {
    const c = (n >> shift) & 255
    const mixed = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount)
    return Math.max(0, Math.min(255, Math.round(mixed)))
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(16)}${channel(8)}${channel(0)}`
}
