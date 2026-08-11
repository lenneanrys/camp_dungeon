import type { Prop, AABB } from './prop'
import { makeProp } from './prop'
import type { PartCuboid } from '../render3d/model'
import { PALETTE, tint } from './palette'
import {
  chimney,
  barrel,
  crate,
  stall,
  tree,
  lamp,
  anvil,
  forge,
  cauldron,
  bottleShelf,
  runeStones,
  bookStand,
  bench,
  banner,
  fencePost,
  herbBox,
  sign,
} from './buildings'
import type { BuildingSpec } from './interiors'
import {
  buildingProps,
  interiorRegion,
  doorway,
  roofId,
  table,
  chair,
  stool,
  bed,
  bedSideways,
  fireplace,
  rug,
  shelf,
  chest,
  lantern,
  put,
  interiorColliders,
} from './interiors'
import {
  signpost,
  noticeBoard,
  flowerBed,
  trough,
  woodpile,
  cart,
} from './landmarks'
import type { SignArm } from './landmarks'
import { buildWalls } from './fortifications'

/**
 * The village.
 *
 * A cross around a central plaza. Every building can be walked into — there is
 * no interior scene and no loading, just four walls with a gap in the front
 * one. Compact on purpose: you are never more than a few seconds from
 * anything, which is what makes a hub feel like a home rather than a commute.
 */

export const SPAWN = { x: 0, z: 96 }
export const MARKET_X = 40

export interface Station {
  id: string
  x: number
  z: number
  facing: { x: number; y: number }
}

export const STATIONS: Station[] = [
  { id: 'blacksmith', x: -196, z: 62, facing: { x: 0.4, y: 1 } },
  { id: 'alchemist', x: 196, z: 62, facing: { x: -0.4, y: 1 } },
  { id: 'enchanter', x: 44, z: -142, facing: { x: 0, y: 1 } },
  { id: 'merchant', x: MARKET_X, z: 138, facing: { x: 0, y: 1 } },
]

export const DUMMY_SPOTS = [
  { x: -320, z: 268 },
  { x: -262, z: 292 },
  { x: -204, z: 268 },
]

const SHOP_W = 84
const SHOP_D = 68
const WALL_H = 44

/** Every walk-in building in the village. */
export const BUILDINGS: BuildingSpec[] = [
  {
    id: 'blacksmith',
    x: -200,
    z: 0,
    w: SHOP_W,
    d: SHOP_D,
    wallH: WALL_H,
    wall: tint(PALETTE.timberDark, 0.14),
    trim: PALETTE.timberDark,
    roof: PALETTE.iron,
    floor: PALETTE.cobble,
    interior: [
      put(fireplace(), 0, -20, { w: 34, d: 15 }),
      put(bed(), -25, -4, { w: 22, d: 38 }),
      put(table(), 20, -13, { w: 30, d: 18 }),
      put(chair('smithChair'), 26, 8, { w: 13, d: 13 }),
      put(lantern('smithLantern'), 20, -13, undefined, 17),
      put(rug(PALETTE.timberDark), 0, 12),
    ],
    exterior: chimney(28, -20, WALL_H, 24),
  },
  {
    id: 'alchemist',
    x: 200,
    z: 0,
    w: SHOP_W,
    d: SHOP_D,
    wallH: WALL_H,
    wall: PALETTE.plaster,
    trim: PALETTE.timber,
    roof: PALETTE.thatch,
    floor: PALETTE.timber,
    interior: [
      put(shelf('alchShelf'), -14, -22, { w: 26, d: 10 }),
      put(shelf('alchShelf2'), 14, -22, { w: 26, d: 10 }),
      put(bed(), 25, 2, { w: 22, d: 38 }),
      put(table(), -20, -13, { w: 30, d: 18 }),
      put(chair('alchChair'), -26, 8, { w: 13, d: 13 }),
      put(lantern('alchLantern'), -20, -13, undefined, 17),
      put(rug(PALETTE.leaf), 0, 12),
    ],
  },
  {
    id: 'enchanter',
    x: 0,
    z: -200,
    w: SHOP_W,
    d: SHOP_D,
    wallH: WALL_H,
    wall: PALETTE.stone,
    trim: PALETTE.roofBlue,
    roof: PALETTE.roofBlue,
    floor: PALETTE.cobble,
    interior: [
      put(shelf('enchShelf'), -14, -22, { w: 26, d: 10 }),
      put(shelf('enchShelf2'), 14, -22, { w: 26, d: 10 }),
      put(bed(), -25, 2, { w: 22, d: 38 }),
      put(table(), 20, -13, { w: 30, d: 18 }),
      put(chair('enchChair'), 26, 8, { w: 13, d: 13 }),
      put(rug('#4a3f7a'), 0, 12),
      put(lantern('enchLanternA'), 20, -13, undefined, 17),
    ],
  },
  // Homes. Nothing to do in them yet — they are here so the town reads as a
  // place people live rather than four shops in a field.
  {
    id: 'homeA',
    x: -108,
    z: -180,
    w: 78,
    d: 66,
    wallH: 40,
    wall: PALETTE.plaster,
    trim: PALETTE.timber,
    roof: PALETTE.roofTile,
    floor: PALETTE.timber,
    interior: [
      put(bedSideways(), -8, -14, { w: 38, d: 22 }),
      put(chest(), 22, -18, { w: 21, d: 14 }),
      put(chair('homeAChair'), 24, 6, { w: 13, d: 13 }),
      put(rug(PALETTE.cloth), 0, 8),
    ],
    exterior: chimney(-22, -16, 40, 18),
  },
  {
    id: 'homeB',
    x: 126,
    z: -176,
    w: 78,
    d: 66,
    wallH: 40,
    wall: tint(PALETTE.plaster, -0.1),
    trim: PALETTE.timberDark,
    roof: PALETTE.thatch,
    floor: PALETTE.timber,
    interior: [
      put(bedSideways(), 12, -14, { w: 38, d: 22 }),
      put(shelf('homeBShelf'), -20, -20, { w: 26, d: 10 }),
      put(chair('homeBChair'), -24, 6, { w: 13, d: 13 }),
      put(rug(PALETTE.roofBlue), 0, 8),
    ],
  },
  {
    id: 'homeC',
    x: -136,
    z: 126,
    w: 78,
    d: 66,
    wallH: 40,
    wall: PALETTE.plaster,
    trim: PALETTE.timber,
    roof: PALETTE.roofTile,
    floor: PALETTE.timber,
    interior: [
      put(bedSideways(), -8, -14, { w: 38, d: 22 }),
      put(chair('homeCChairA'), 24, 6, { w: 13, d: 13 }),
      put(chair('homeCChairB'), -24, 6, { w: 13, d: 13 }),
      put(stool('homeCStool'), 22, -18, { w: 10, d: 10 }),
      put(rug(PALETTE.clothAlt), 0, 8),
    ],
    exterior: chimney(20, -14, 40, 16),
  },
  {
    id: 'homeD',
    x: 188,
    z: 150,
    w: 78,
    d: 66,
    wallH: 40,
    wall: tint(PALETTE.plaster, 0.06),
    trim: PALETTE.timber,
    roof: PALETTE.thatch,
    floor: PALETTE.timber,
    interior: [
      put(bedSideways(), 10, -14, { w: 38, d: 22 }),
      put(chest(), -20, -18, { w: 21, d: 14 }),
      put(chair('homeDChair'), -24, 6, { w: 13, d: 13 }),
      put(rug(PALETTE.leaf), 0, 8),
    ],
  },
]

/** Where each building can be entered, for signage and testing. */
export const DOORWAYS = BUILDINGS.map((spec) => ({ id: spec.id, ...doorway(spec) }))

/** Which building the player is standing inside, if any. */
export function buildingAt(x: number, z: number): BuildingSpec | null {
  for (const spec of BUILDINGS) {
    const r = interiorRegion(spec)
    if (x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ) return spec
  }
  return null
}

/** The roof prop to hide while standing inside a given building. */
export const roofPropId = roofId

function at(
  id: string,
  x: number,
  z: number,
  cuboids: PartCuboid[],
  opts?: { collider?: { w: number; d: number }; shadow?: number },
): Prop {
  return makeProp(id, { x, y: 0, z }, cuboids, opts)
}

/** The plaza signpost, pointing at everything worth walking to. */
export function plazaSignpost(): { parts: ReturnType<typeof signpost>['parts']; pose: ReturnType<typeof signpost>['pose'] } {
  const arms: SignArm[] = [
    { color: PALETTE.iron, dir: { x: -1, z: 0 }, y: 56 }, // blacksmith, west
    { color: '#6fbf73', dir: { x: 1, z: 0 }, y: 48 }, // alchemist, east
    { color: '#8ad4ff', dir: { x: 0, z: -1 }, y: 40 }, // enchanter, north
    { color: PALETTE.cloth, dir: { x: 0.3, z: 1 }, y: 32 }, // market, south
    { color: PALETTE.straw, dir: { x: -0.8, z: 0.6 }, y: 24 }, // training, south-west
  ]
  return signpost(arms)
}

/** Dead centre of the plaza, where the well used to stand. */
export const SIGNPOST_POS = { x: 0, y: 0, z: 0 }

export function buildVillage(): Prop[] {
  const props: Prop[] = []

  // The curtain wall first, so everything else sits inside it.
  props.push(...buildWalls())

  for (const spec of BUILDINGS) props.push(...buildingProps(spec))

  // ---- Blacksmith yard ----
  props.push(at('forge', -258, 62, forge(), { collider: { w: 26, d: 20 }, shadow: 15 }))
  props.push(at('anvil', -160, 66, anvil(), { collider: { w: 12, d: 12 }, shadow: 8 }))
  props.push(at('smithBarrel', -134, 52, barrel(), { collider: { w: 9, d: 9 }, shadow: 6 }))
  props.push(at('smithSign', -200, 52, sign(PALETTE.iron), { shadow: 3 }))
  props.push(at('woodpile', -262, 8, woodpile(), { collider: { w: 34, d: 24 }, shadow: 18 }))
  props.push(at('smithTrough', -258, 108, trough(), { collider: { w: 34, d: 15 }, shadow: 17 }))

  // ---- Alchemist yard ----
  props.push(at('cauldron', 258, 62, cauldron(), { collider: { w: 18, d: 18 }, shadow: 12 }))
  props.push(at('bottles', 160, 56, bottleShelf(), { collider: { w: 34, d: 8 }, shadow: 14 }))
  props.push(at('herbA', 262, 8, herbBox(), { collider: { w: 20, d: 10 }, shadow: 9 }))
  props.push(at('herbB', 262, -8, herbBox(), { collider: { w: 20, d: 10 }, shadow: 9 }))
  props.push(at('alchSign', 200, 52, sign('#6fbf73'), { shadow: 3 }))

  // ---- Enchanter grounds ----
  props.push(at('runes', -56, -120, runeStones(), { collider: { w: 50, d: 8 }, shadow: 20 }))
  props.push(at('bookStand', 0, -140, bookStand(), { collider: { w: 16, d: 12 }, shadow: 9 }))
  props.push(at('enchSign', 0, -152, sign('#8ad4ff'), { shadow: 3 }))

  // ---- Merchant market ----
  const m = MARKET_X
  props.push(at('stallA', m, 200, stall(), { collider: { w: 48, d: 28 }, shadow: 26 }))
  props.push(
    at('stallB', m - 80, 200, stall('#3f6f8c', PALETTE.clothAlt), {
      collider: { w: 48, d: 28 },
      shadow: 26,
    }),
  )
  props.push(
    at('stallC', m + 80, 200, stall('#7a5a9c', PALETTE.clothAlt), {
      collider: { w: 48, d: 28 },
      shadow: 26,
    }),
  )
  props.push(at('wareA', m - 40, 172, crate(12), { collider: { w: 12, d: 12 }, shadow: 7 }))
  props.push(at('wareB', m - 40, 158, barrel(), { collider: { w: 9, d: 9 }, shadow: 6 }))
  props.push(at('wareC', m + 40, 172, barrel(), { collider: { w: 9, d: 9 }, shadow: 6 }))
  props.push(at('wareD', m + 40, 158, crate(10), { collider: { w: 10, d: 10 }, shadow: 6 }))
  props.push(at('cart', m + 210, 212, cart(), { collider: { w: 40, d: 26 }, shadow: 22 }))

  // ---- Central plaza ----
  props.push(at('notices', 62, -52, noticeBoard(), { collider: { w: 38, d: 6 }, shadow: 18 }))
  props.push(at('benchA', -74, 46, bench(), { collider: { w: 28, d: 9 }, shadow: 15 }))
  props.push(at('benchB', 74, 46, bench(), { collider: { w: 28, d: 9 }, shadow: 15 }))
  props.push(at('plazaTrough', 0, 62, trough(), { collider: { w: 34, d: 15 }, shadow: 17 }))

  for (const [i, spot] of [
    { x: -84, z: -20, c: ['#d4566a', '#e0b455', '#d4566a'] },
    { x: 84, z: -20, c: ['#8a6fc4', '#e8dfc4', '#8a6fc4'] },
    { x: -84, z: 20, c: ['#e0b455', '#d4566a', '#e0b455'] },
    { x: 84, z: 20, c: ['#e8dfc4', '#8a6fc4', '#e8dfc4'] },
  ].entries()) {
    props.push(at(`flowers${i}`, spot.x, spot.z, flowerBed(spot.c), { shadow: 8 }))
  }

  props.push(at('bannerA', -60, 86, banner(PALETTE.cloth), { shadow: 4 }))
  props.push(at('bannerB', 60, 86, banner(PALETTE.roofBlue), { shadow: 4 }))

  for (const [i, spot] of [
    { x: -120, z: -76 },
    { x: 120, z: -76 },
    { x: -120, z: 88 },
    { x: 120, z: 88 },
  ].entries()) {
    props.push(at(`lamp${i}`, spot.x, spot.z, lamp(), { collider: { w: 4, d: 4 }, shadow: 4 }))
  }

  // ---- Training yard, off in the south-west on its own ----
  const fenceZ = 224
  const gate = 4
  for (let i = 0; i < 10; i++) {
    if (i === gate || i === gate + 1) continue
    props.push(at(`fenceN${i}`, -360 + i * 18, fenceZ, fencePost(), { shadow: 3 }))
  }
  for (let i = 0; i < 5; i++) {
    props.push(at(`fenceE${i}`, -172, fenceZ + 18 + i * 18, fencePost(), { shadow: 3 }))
  }
  props.push(at('yardSign', -262, fenceZ - 16, sign(PALETTE.straw), { shadow: 3 }))
  props.push(at('yardCrate', -340, 300, crate(11), { collider: { w: 11, d: 11 }, shadow: 7 }))
  props.push(at('yardBarrel', -190, 310, barrel(), { collider: { w: 9, d: 9 }, shadow: 6 }))
  props.push(at('yardRack', -300, 316, woodpile(), { collider: { w: 34, d: 24 }, shadow: 18 }))

  // ---- Trees, softening the edges ----
  const scatter = [
    { x: -330, z: -110, s: 1.1 },
    { x: 330, z: -110, s: 1 },
    { x: -300, z: 150, s: 0.9 },
    { x: 300, z: 260, s: 1.15 },
    { x: -180, z: -250, s: 1 },
    { x: 190, z: -250, s: 0.95 },
    { x: 60, z: -280, s: 1.05 },
    { x: -60, z: 320, s: 0.9 },
    { x: 300, z: 120, s: 0.85 },
    { x: -300, z: -20, s: 0.8 },
  ]
  for (const [i, t] of scatter.entries()) {
    props.push(at(`tree${i}`, t.x, t.z, tree(t.s), { collider: { w: 8, d: 8 }, shadow: 13 * t.s }))
  }

  return props
}

/**
 * Everything that blocks movement, in model units: props with a footprint, and
 * the furniture inside every building.
 */
export function villageColliders(props: Prop[]): AABB[] {
  const out: AABB[] = []
  for (const spec of BUILDINGS) out.push(...interiorColliders(spec))
  for (const p of props) {
    if (!p.collider) continue
    out.push({
      minX: p.pos.x - p.collider.w / 2,
      maxX: p.pos.x + p.collider.w / 2,
      minZ: p.pos.z - p.collider.d / 2,
      maxZ: p.pos.z + p.collider.d / 2,
    })
  }
  return out
}
