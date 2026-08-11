import type { PartCuboid } from '../render3d/model'
import { PALETTE, tint } from './palette'

/**
 * The block kit. Every structure in the village is assembled from these, which
 * is what makes the buildings look like they belong to the same town.
 *
 * All positions are relative to the prop's own origin: x/z centred, y = 0 on
 * the ground.
 */

export function b(
  id: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: string,
): PartCuboid {
  return { id, pos: { x, y: y + h / 2, z }, size: { w, h, d }, color }
}

/** A flat decal painted on a surface — one face, so it never shows from behind. */
export function decal(
  id: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  color: string,
): PartCuboid {
  return { id, pos: { x, y: y + h / 2, z }, size: { w, h, d: 0.4 }, color, decal: true }
}

export interface HouseSpec {
  w: number
  d: number
  wallH: number
  wall: string
  trim: string
  roof: string
  /** Steps in the pitched roof. More steps = smoother, more cuboids. */
  roofSteps?: number
}

/**
 * A stepped gable roof. Each course is shallower than the one below, which
 * approximates a pitch in blocks — the same trick Minecraft builders use, and
 * it reads far better than a flat slab.
 */
export function gableRoof(spec: HouseSpec, prefix: string): PartCuboid[] {
  const steps = spec.roofSteps ?? 4
  const overhang = 4
  const stepH = 4
  const out: PartCuboid[] = []

  for (let i = 0; i < steps; i++) {
    const t = i / steps
    const depth = spec.d + overhang * 2 - t * (spec.d + overhang * 2 - 6)
    out.push(
      b(
        `${prefix}roof${i}`,
        0,
        spec.wallH + i * stepH,
        0,
        spec.w + overhang * 2,
        stepH,
        depth,
        // Darken each course slightly so the steps read as separate courses.
        tint(spec.roof, -0.05 * i),
      ),
    )
  }
  return out
}

/** Walls, corner posts, a door and two windows. */
export function house(spec: HouseSpec, prefix: string): PartCuboid[] {
  const { w, d, wallH } = spec
  const front = d / 2
  const post = 4

  return [
    b(`${prefix}walls`, 0, 0, 0, w, wallH, d, spec.wall),

    // Corner timbers give the plaster something to sit between.
    b(`${prefix}postA`, -w / 2 + post / 2, 0, -d / 2 + post / 2, post, wallH, post, spec.trim),
    b(`${prefix}postB`, w / 2 - post / 2, 0, -d / 2 + post / 2, post, wallH, post, spec.trim),
    b(`${prefix}postC`, -w / 2 + post / 2, 0, front - post / 2, post, wallH, post, spec.trim),
    b(`${prefix}postD`, w / 2 - post / 2, 0, front - post / 2, post, wallH, post, spec.trim),

    // A beam under the eaves ties the front together.
    b(`${prefix}beam`, 0, wallH - 4, 0, w + 1, 4, d + 1, spec.trim),

    b(`${prefix}door`, 0, 0, front, 14, 22, 2, PALETTE.timberDark),
    b(`${prefix}knob`, 4, 11, front + 1.4, 1.6, 1.6, 1.6, PALETTE.copper),

    b(`${prefix}winL`, -w / 4 - 4, wallH - 20, front, 10, 10, 2, PALETTE.timber),
    decal(`${prefix}glassL`, -w / 4 - 4, wallH - 18.5, front + 1.4, 7, 7, PALETTE.glass),
    b(`${prefix}winR`, w / 4 + 4, wallH - 20, front, 10, 10, 2, PALETTE.timber),
    decal(`${prefix}glassR`, w / 4 + 4, wallH - 18.5, front + 1.4, 7, 7, PALETTE.glass),

    ...gableRoof(spec, prefix),
  ]
}

export function chimney(x: number, z: number, baseY: number, height: number): PartCuboid[] {
  return [
    b('chimney', x, baseY, z, 9, height, 9, PALETTE.stone),
    b('chimneyCap', x, baseY + height, z, 11, 2, 11, PALETTE.cobble),
  ]
}

export function barrel(prefix = ''): PartCuboid[] {
  return [
    b(`${prefix}barrelBody`, 0, 0, 0, 9, 13, 9, PALETTE.timber),
    b(`${prefix}barrelBandA`, 0, 3, 0, 10, 1.6, 10, PALETTE.iron),
    b(`${prefix}barrelBandB`, 0, 9, 0, 10, 1.6, 10, PALETTE.iron),
    b(`${prefix}barrelLid`, 0, 13, 0, 9.5, 1, 9.5, tint(PALETTE.timber, -0.15)),
  ]
}

export function crate(size = 10, prefix = ''): PartCuboid[] {
  return [
    b(`${prefix}crate`, 0, 0, 0, size, size, size, PALETTE.timber),
    b(`${prefix}crateTrimA`, 0, size / 2 - 0.8, 0, size + 0.6, 1.6, size + 0.6, tint(PALETTE.timber, -0.2)),
  ]
}

export function fencePost(): PartCuboid[] {
  return [
    b('fencePost', 0, 0, 0, 3, 14, 3, PALETTE.timber),
    b('fenceRailA', 0, 5, 0, 16, 2, 1.6, PALETTE.timber),
    b('fenceRailB', 0, 10, 0, 16, 2, 1.6, PALETTE.timber),
  ]
}

export function lamp(): PartCuboid[] {
  return [
    b('lampPost', 0, 0, 0, 3, 26, 3, PALETTE.iron),
    b('lampArm', 0, 26, 0, 6, 2, 6, PALETTE.iron),
    b('lampGlass', 0, 28, 0, 7, 8, 7, PALETTE.straw),
    b('lampCap', 0, 36, 0, 9, 2, 9, PALETTE.iron),
  ]
}

export function tree(scale = 1): PartCuboid[] {
  const h = 30 * scale
  return [
    b('trunk', 0, 0, 0, 7 * scale, h, 7 * scale, PALETTE.timberDark),
    b('leafA', 0, h - 4, 0, 30 * scale, 12 * scale, 30 * scale, PALETTE.leaf),
    b('leafB', 0, h + 7 * scale, 0, 22 * scale, 10 * scale, 22 * scale, tint(PALETTE.leaf, 0.1)),
    b('leafC', 0, h + 15 * scale, 0, 12 * scale, 8 * scale, 12 * scale, tint(PALETTE.leaf, 0.18)),
  ]
}

export function well(): PartCuboid[] {
  return [
    b('wellRing', 0, 0, 0, 26, 12, 26, PALETTE.cobble),
    b('wellInner', 0, 10, 0, 18, 3, 18, '#1b2029'),
    b('wellPostL', -10, 12, 0, 3, 26, 3, PALETTE.timber),
    b('wellPostR', 10, 12, 0, 3, 26, 3, PALETTE.timber),
    b('wellBeam', 0, 36, 0, 24, 3, 3, PALETTE.timber),
    ...gableRoof({ w: 24, d: 20, wallH: 39, wall: '', trim: '', roof: PALETTE.thatch, roofSteps: 3 }, 'well'),
    b('wellBucket', 0, 28, 0, 6, 6, 6, PALETTE.timberDark),
    b('wellRope', 0, 34, 0, 1, 8, 1, PALETTE.rope),
  ]
}

/** A market stall: four posts, a striped canopy and a counter of wares. */
export function stall(
  clothA: string = PALETTE.cloth,
  clothB: string = PALETTE.clothAlt,
): PartCuboid[] {
  // Posts clear the player's 36-unit height, so you can walk under the awning
  // instead of clipping through it.
  const postH = 42
  const out: PartCuboid[] = [
    b('stallPostA', -22, 0, -12, 3, postH, 3, PALETTE.timber),
    b('stallPostB', 22, 0, -12, 3, postH, 3, PALETTE.timber),
    b('stallPostC', -22, 0, 12, 3, postH, 3, PALETTE.timber),
    b('stallPostD', 22, 0, 12, 3, postH, 3, PALETTE.timber),
    b('stallCounter', 0, 14, 8, 48, 4, 14, PALETTE.timber),
    b('stallCounterLeg', 0, 0, 8, 44, 14, 10, tint(PALETTE.timber, -0.2)),
  ]

  // Striped canopy — alternating cloth strips, the classic market read.
  const strips = 7
  for (let i = 0; i < strips; i++) {
    const w = 50 / strips
    out.push(
      b(`canopy${i}`, -25 + w / 2 + i * w, postH + 1, 0, w, 3, 34, i % 2 === 0 ? clothA : clothB),
    )
  }
  out.push(b('canopyRidge', 0, postH + 4, 0, 52, 3, 12, tint(clothA, -0.15)))
  return out
}

export function sign(color: string): PartCuboid[] {
  return [
    b('signPost', 0, 0, 0, 2.5, 24, 2.5, PALETTE.timber),
    b('signBoard', 0, 18, 1.5, 18, 10, 1.5, PALETTE.timber),
    decal('signGlyph', 0, 21, 2.6, 8, 5, color),
  ]
}

export function anvil(): PartCuboid[] {
  return [
    b('anvilStump', 0, 0, 0, 12, 9, 12, PALETTE.timberDark),
    b('anvilBase', 0, 9, 0, 9, 3, 7, PALETTE.iron),
    b('anvilWaist', 0, 12, 0, 5, 3, 5, PALETTE.iron),
    b('anvilTop', 0, 15, 0, 14, 4, 7, PALETTE.iron),
  ]
}

export function forge(): PartCuboid[] {
  return [
    b('forgeBase', 0, 0, 0, 26, 14, 20, PALETTE.stone),
    b('forgeCoals', 0, 14, 0, 18, 2, 12, '#c4531f'),
    b('forgeHood', 0, 22, -4, 24, 10, 14, PALETTE.iron),
    b('forgeFlue', 0, 32, -4, 9, 16, 9, PALETTE.stone),
  ]
}

export function cauldron(): PartCuboid[] {
  return [
    b('cauldronLegA', -5, 0, -5, 2.5, 5, 2.5, PALETTE.iron),
    b('cauldronLegB', 5, 0, -5, 2.5, 5, 2.5, PALETTE.iron),
    b('cauldronLegC', -5, 0, 5, 2.5, 5, 2.5, PALETTE.iron),
    b('cauldronLegD', 5, 0, 5, 2.5, 5, 2.5, PALETTE.iron),
    b('cauldronPot', 0, 5, 0, 18, 12, 18, PALETTE.iron),
    b('cauldronBrew', 0, 16, 0, 15, 2, 15, '#5fae6b'),
    b('cauldronRim', 0, 17, 0, 19, 2, 19, tint(PALETTE.iron, 0.15)),
  ]
}

/** A rack of coloured bottles — the alchemist's read at a glance. */
export function bottleShelf(): PartCuboid[] {
  const colors = ['#6fbf73', '#c2547d', '#5aa3d0', '#d4a13c', '#8a6fc4']
  const out: PartCuboid[] = [
    b('shelfBack', 0, 0, -3, 34, 30, 3, PALETTE.timberDark),
    b('shelfA', 0, 11, 0, 34, 2, 8, PALETTE.timber),
    b('shelfB', 0, 23, 0, 34, 2, 8, PALETTE.timber),
  ]
  colors.forEach((c, i) => {
    out.push(b(`bottleLo${i}`, -13 + i * 6.5, 13, 0, 4, 7, 4, c))
    out.push(b(`bottleHi${i}`, -13 + i * 6.5, 25, 0, 4, 6, 4, colors[(i + 2) % colors.length]!))
  })
  return out
}

/** Rune stones and a floating book: the enchanter, without any text. */
export function runeStones(): PartCuboid[] {
  const out: PartCuboid[] = []
  const glyphs = ['#8ad4ff', '#c79bff', '#8affc9']
  for (let i = 0; i < 3; i++) {
    const x = -20 + i * 20
    out.push(b(`rune${i}`, x, 0, 0, 10, 22 - i * 3, 8, PALETTE.stone))
    out.push(decal(`runeGlyph${i}`, x, 8, 4.3, 5, 6, glyphs[i]!))
  }
  return out
}

export function bookStand(): PartCuboid[] {
  return [
    b('standPost', 0, 0, 0, 5, 18, 5, PALETTE.timberDark),
    b('standTop', 0, 18, 0, 16, 2, 12, PALETTE.timberDark),
    b('bookL', -4, 20, 0, 7, 2, 11, PALETTE.plaster),
    b('bookR', 4, 20, 0, 7, 2, 11, PALETTE.plaster),
    b('bookSpine', 0, 20, 0, 2, 3, 11, PALETTE.roofBlue),
    b('bookGlow', 0, 24, 0, 5, 5, 5, '#8ad4ff'),
  ]
}

export function bench(): PartCuboid[] {
  return [
    b('benchSeat', 0, 8, 0, 28, 3, 9, PALETTE.timber),
    b('benchLegL', -11, 0, 0, 3, 8, 8, tint(PALETTE.timber, -0.2)),
    b('benchLegR', 11, 0, 0, 3, 8, 8, tint(PALETTE.timber, -0.2)),
    b('benchBack', 0, 11, -4, 28, 8, 2, PALETTE.timber),
  ]
}

export function banner(color: string): PartCuboid[] {
  return [
    b('bannerPole', 0, 0, 0, 3, 40, 3, PALETTE.timber),
    b('bannerCloth', 0, 20, 2, 12, 18, 1.6, color),
    b('bannerTrim', 0, 20, 2, 12, 2, 2, PALETTE.copper),
    b('bannerTop', 0, 40, 0, 5, 3, 5, PALETTE.copper),
  ]
}

export function herbBox(): PartCuboid[] {
  return [
    b('herbBox', 0, 0, 0, 20, 7, 10, PALETTE.timber),
    b('herbSoil', 0, 7, 0, 18, 1.5, 8, PALETTE.dirt),
    b('herbA', -6, 8, 0, 5, 7, 5, PALETTE.leaf),
    b('herbB', 0, 8, 0, 5, 9, 5, tint(PALETTE.leaf, 0.15)),
    b('herbC', 6, 8, 0, 5, 6, 5, PALETTE.leaf),
  ]
}
