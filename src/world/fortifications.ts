import type { PartCuboid } from '../render3d/model'
import type { Prop } from './prop'
import { makeProp } from './prop'
import { PALETTE, tint } from './palette'
import { b, decal } from './buildings'

/**
 * The curtain wall.
 *
 * Built from many short segments rather than four long ones — the scene sorts
 * per object, so a single wall running the length of the town could never
 * interleave correctly with a player walking along it.
 *
 * The wall is thick enough to walk along: battlements sit on the OUTER half
 * and the inner half is a clear walkway for the garrison.
 */

export const WALL = { minX: -440, maxX: 440, minZ: -360, maxZ: 420 }

export const SEGMENT = 40
export const WALL_H = 58
/** Thick enough for a walkway behind the battlements. */
export const WALL_T = 28
/** Height of the walkway surface, where the garrison stands. */
export const WALKWAY_Y = WALL_H
/** How far in from the wall centreline the walkway runs. */
export const WALKWAY_INSET = 7

const MERLON_H = 11
const MERLON_D = 11

const TOWER_SIZE = 34
export const TOWER_FOOT = TOWER_SIZE + 6
/** How far a wall runs into whatever it abuts, to close the junction. */
const JUNCTION_OVERRUN = 9
const TOWER_H = 90

export const GATE_W = 76
/** Overall height of a gatehouse, parapet included. */
export const GATE_HEIGHT = WALL_H + 14
const GATE_FOOT = GATE_W + 12
/** Distance from a gate's centre to the towers flanking it. */
export const GATE_FLANK = GATE_FOOT / 2 + TOWER_FOOT / 2

export type Side = 'north' | 'south' | 'west' | 'east'

/** Where each gate stands, and which way is out. */
export const GATES: { side: Side; x: number; z: number; horizontal: boolean; outward: number }[] = [
  { side: 'north', x: 0, z: WALL.minZ, horizontal: true, outward: -1 },
  { side: 'south', x: 0, z: WALL.maxZ, horizontal: true, outward: 1 },
  { side: 'west', x: WALL.minX, z: 0, horizontal: false, outward: -1 },
  { side: 'east', x: WALL.maxX, z: 0, horizontal: false, outward: 1 },
]

const FLAG_COLORS = ['#a8412f', '#3c4d7a', '#4e6b3f', '#7a5a9c', '#c2a878', '#8a3f5a']

/**
 * Merlons along the top, tiled to reach both ends exactly.
 *
 * Spacing them at a fixed pitch and centring the row leaves a sliver of bare
 * wall at each end — the small gap that showed up beside every tower.
 */
function battlements(
  prefix: string,
  length: number,
  y: number,
  horizontal: boolean,
  outward: number,
): PartCuboid[] {
  const out: PartCuboid[] = []
  const count = Math.max(1, Math.round(length / 18))
  const pitch = length / count
  const width = pitch * 0.58
  const offset = outward * (WALL_T / 2 - MERLON_D / 2)

  for (let i = 0; i < count; i++) {
    const along = -length / 2 + pitch * (i + 0.5)
    out.push(
      b(
        `${prefix}Merlon${i}`,
        horizontal ? along : offset,
        y,
        horizontal ? offset : along,
        horizontal ? width : MERLON_D,
        MERLON_H,
        horizontal ? MERLON_D : width,
        tint(PALETTE.stone, 0.06),
      ),
    )
  }
  return out
}

/** One length of curtain wall. */
export function wallSegment(
  horizontal: boolean,
  length: number = SEGMENT,
  outward = 1,
): PartCuboid[] {
  // Geometry overruns each end far enough to reach inside a tower's SHAFT,
  // which is narrower than its base — stopping at the base left a hole in the
  // wall face everywhere a segment met a tower. The collider stays the exact
  // length, so nothing overlaps.
  const geo = length + JUNCTION_OVERRUN * 2
  const w = horizontal ? geo : WALL_T
  const d = horizontal ? WALL_T : geo

  void outward
  return [
    b('wallBase', 0, 0, 0, w + 5, 9, d + 5, PALETTE.cobble),
    b('wallBody', 0, 9, 0, w, WALL_H - 15, d, PALETTE.stone),
    // The walkway deck, a shade lighter so the top reads as a surface.
    b('wallDeck', 0, WALL_H - 6, 0, w, 6, d, tint(PALETTE.cobble, 0.08)),
  ]
}

/** Distance from the wall centreline out to the battlements. */
export const CROWN_OFFSET = WALL_T / 2 - MERLON_D / 2

/**
 * The battlements, as their own prop.
 *
 * A sentry stands INSIDE the wall's bounding volume — on top of the body, behind
 * the merlons. One object cannot be both in front of and behind him, so the
 * crown has to sort separately. Being 60-odd units up, it lands after him and
 * correctly hides his legs.
 */
export function wallCrown(horizontal: boolean, length: number = SEGMENT): PartCuboid[] {
  // Authored centred on its own origin; the prop is placed on the outer half.
  return battlements('wall', length, WALL_H, horizontal, 0)
}

/** A tower, with a roof and a flag. */
export function tower(flagColor: string): PartCuboid[] {
  const s = TOWER_SIZE
  const out: PartCuboid[] = [
    b('towerBase', 0, 0, 0, s + 6, 11, s + 6, PALETTE.cobble),
    b('towerShaft', 0, 11, 0, s, TOWER_H - 11, s, PALETTE.stone),
    b('towerCorbel', 0, TOWER_H - 11, 0, s + 7, 5, s + 7, PALETTE.cobble),
  ]

  const parapetY = TOWER_H - 6
  const half = (s + 7) / 2 - 3.5
  for (let i = 0; i < 4; i++) {
    const along = -half + 3.5 + i * ((half * 2 - 7) / 3)
    out.push(b(`towerMerlonN${i}`, along, parapetY, -half, 8, MERLON_H, 7, tint(PALETTE.stone, 0.06)))
    out.push(b(`towerMerlonS${i}`, along, parapetY, half, 8, MERLON_H, 7, tint(PALETTE.stone, 0.06)))
    out.push(b(`towerMerlonW${i}`, -half, parapetY, along, 7, MERLON_H, 8, tint(PALETTE.stone, 0.06)))
    out.push(b(`towerMerlonE${i}`, half, parapetY, along, 7, MERLON_H, 8, tint(PALETTE.stone, 0.06)))
  }

  const roofY = parapetY + MERLON_H
  for (let i = 0; i < 4; i++) {
    const size = s - 2 - i * 7
    out.push(b(`towerRoof${i}`, 0, roofY + i * 6, 0, size, 6, size, tint(PALETTE.roofTile, -0.04 * i)))
  }

  out.push(decal('towerSlit', 0, 42, TOWER_SIZE / 2 + 0.2, 3, 15, '#1b1f26'))

  const poleY = roofY + 24
  out.push(b('towerPole', 0, poleY, 0, 2.5, 34, 2.5, PALETTE.timberDark))
  out.push(b('towerFlag', 9, poleY + 18, 0, 18, 12, 1.6, flagColor))
  out.push(b('towerFlagTail', 17, poleY + 20, 0, 5, 8, 1.6, tint(flagColor, -0.15)))
  out.push(b('towerFinial', 0, poleY + 34, 0, 5, 5, 5, PALETTE.copper))

  return out
}

/** A gatehouse: heavy timber doors, firmly shut. */
export function gatehouse(horizontal: boolean, outward: number): PartCuboid[] {
  const h = GATE_HEIGHT
  const across = (w: number, d: number): [number, number] => (horizontal ? [w, d] : [d, w])
  const out: PartCuboid[] = []

  const [baseW, baseD] = across(GATE_FOOT, WALL_T + 8)
  out.push(b('gateBase', 0, 0, 0, baseW, 11, baseD, PALETTE.cobble))

  // Piers reach right out to the gate's footprint edge. Stopping short left a
  // hole between each pier and the tower flanking it.
  const PIER_W = 24
  const pierOffset = GATE_FOOT / 2 - PIER_W / 2
  for (const [name, offset] of [
    ['L', -pierOffset],
    ['R', pierOffset],
  ] as const) {
    const [pw, pd] = across(PIER_W, WALL_T + 4)
    out.push(
      b(
        `gatePier${name}`,
        horizontal ? offset : 0,
        11,
        horizontal ? 0 : offset,
        pw,
        h - 11,
        pd,
        PALETTE.stone,
      ),
    )
  }

  const opening = GATE_FOOT - PIER_W * 2
  const [archW, archD] = across(opening + PIER_W, WALL_T + 4)
  out.push(b('gateArch', 0, h - 24, 0, archW, 9, archD, PALETTE.stone))
  const [lipW, lipD] = across(GATE_FOOT + 4, WALL_T + 12)
  out.push(b('gateLip', 0, h - 7, 0, lipW, 7, lipD, tint(PALETTE.cobble, 0.08)))

  // The doors, set into the outward face.
  const doorOff = outward * 3
  for (const [name, offset] of [
    ['L', -opening / 4],
    ['R', opening / 4],
  ] as const) {
    const [dw, dd] = across(opening / 2, 7)
    out.push(
      b(
        `gateDoor${name}`,
        horizontal ? offset : doorOff,
        11,
        horizontal ? doorOff : offset,
        dw,
        h - 40,
        dd,
        PALETTE.timberDark,
      ),
    )
  }
  const [bandW, bandD] = across(opening + 2, 6)
  const bandOff = outward * 4
  out.push(
    b('gateBandA', horizontal ? 0 : bandOff, 22, horizontal ? bandOff : 0, bandW, 5, bandD, PALETTE.iron),
  )
  out.push(
    b('gateBandB', horizontal ? 0 : bandOff, 40, horizontal ? bandOff : 0, bandW, 5, bandD, PALETTE.iron),
  )

  out.push(...battlements('gate', GATE_FOOT + 4, h, horizontal, outward))

  // Banners on the inward face.
  const inward = -outward * (WALL_T / 2 + 3)
  for (const [name, offset, color] of [
    ['L', -GATE_W / 2 + 9, '#a8412f'],
    ['R', GATE_W / 2 - 9, '#3c4d7a'],
  ] as const) {
    const [bw, bd] = across(15, 2)
    out.push(
      b(
        `gateBanner${name}`,
        horizontal ? offset : inward,
        h - 48,
        horizontal ? inward : offset,
        bw,
        22,
        bd,
        color,
      ),
    )
  }

  return out
}

export function brazier(): PartCuboid[] {
  return [
    b('brazLegA', -4, 0, -4, 2.5, 14, 2.5, PALETTE.iron),
    b('brazLegB', 4, 0, -4, 2.5, 14, 2.5, PALETTE.iron),
    b('brazLegC', -4, 0, 4, 2.5, 14, 2.5, PALETTE.iron),
    b('brazLegD', 4, 0, 4, 2.5, 14, 2.5, PALETTE.iron),
    b('brazBowl', 0, 14, 0, 14, 8, 14, PALETTE.iron),
    b('brazCoals', 0, 21, 0, 11, 3, 11, '#c4531f'),
    b('brazFlame', 0, 23, 0, 7, 6, 7, '#e8913c'),
  ]
}

/** Every tower position: four corners, plus two flanking each gate. */
export function towerPositions(): { x: number; z: number }[] {
  const corners = [
    { x: WALL.minX, z: WALL.minZ },
    { x: WALL.maxX, z: WALL.minZ },
    { x: WALL.minX, z: WALL.maxZ },
    { x: WALL.maxX, z: WALL.maxZ },
  ]
  const flanks = GATES.flatMap((g) =>
    g.horizontal
      ? [
          { x: g.x - GATE_FLANK, z: g.z },
          { x: g.x + GATE_FLANK, z: g.z },
        ]
      : [
          { x: g.x, z: g.z - GATE_FLANK },
          { x: g.x, z: g.z + GATE_FLANK },
        ],
  )
  return [...corners, ...flanks]
}

/**
 * The whole enclosure.
 *
 * Nothing here fades. A wall that turns translucent as you walk past reads as a
 * rendering fault, and in an enclosed town you are always near one.
 */
export function buildWalls(): Prop[] {
  const props: Prop[] = []
  const towers = towerPositions()

  towers.forEach((t, i) => {
    props.push(
      makeProp(`tower${i}`, { x: t.x, y: 0, z: t.z }, tower(FLAG_COLORS[i % FLAG_COLORS.length]!), {
        collider: { w: TOWER_FOOT, d: TOWER_FOOT },
        shadow: TOWER_SIZE * 0.7,
        noFade: true,
      }),
    )
  })

  /**
   * Fill a run with segments sized to fit the gaps EXACTLY. Stepping at a fixed
   * pitch leaves a hole wherever a tower does not land on the grid.
   */
  const fill = (
    from: number,
    to: number,
    blocked: { from: number; to: number }[],
    emit: (centre: number, length: number) => void,
  ): void => {
    const sorted = [...blocked].sort((a, b) => a.from - b.from)
    let cursor = from

    for (const gap of [...sorted, { from: to, to }]) {
      const span = Math.min(gap.from, to) - cursor
      if (span > 2) {
        const count = Math.max(1, Math.round(span / SEGMENT))
        const length = span / count
        for (let i = 0; i < count; i++) emit(cursor + length * (i + 0.5), length)
      }
      cursor = Math.max(cursor, gap.to)
    }
  }

  const blockersOn = (axis: 'x' | 'z', at: number): { from: number; to: number }[] => {
    const out = towers
      .filter((t) => (axis === 'x' ? t.z : t.x) === at)
      .map((t) => {
        const centre = axis === 'x' ? t.x : t.z
        return { from: centre - TOWER_FOOT / 2, to: centre + TOWER_FOOT / 2 }
      })
    for (const g of GATES) {
      if ((axis === 'x' ? g.z : g.x) !== at) continue
      const centre = axis === 'x' ? g.x : g.z
      out.push({ from: centre - GATE_FOOT / 2, to: centre + GATE_FOOT / 2 })
    }
    return out
  }

  for (const z of [WALL.minZ, WALL.maxZ]) {
    const outward = z === WALL.minZ ? -1 : 1
    fill(WALL.minX - TOWER_FOOT / 2, WALL.maxX + TOWER_FOOT / 2, blockersOn('x', z), (x, length) => {
      props.push(
        makeProp(`wallH_${z}_${Math.round(x)}`, { x, y: 0, z }, wallSegment(true, length, outward), {
          collider: { w: length, d: WALL_T + 4 },
          shadow: length * 0.4,
          noFade: true,
        }),
      )
      props.push(
        makeProp(
          `crownH_${z}_${Math.round(x)}`,
          { x, y: 0, z: z + outward * CROWN_OFFSET },
          wallCrown(true, length),
          { noFade: true },
        ),
      )
    })
  }

  for (const x of [WALL.minX, WALL.maxX]) {
    const outward = x === WALL.minX ? -1 : 1
    fill(WALL.minZ - TOWER_FOOT / 2, WALL.maxZ + TOWER_FOOT / 2, blockersOn('z', x), (z, length) => {
      props.push(
        makeProp(`wallV_${x}_${Math.round(z)}`, { x, y: 0, z }, wallSegment(false, length, outward), {
          collider: { w: WALL_T + 4, d: length },
          shadow: length * 0.4,
          noFade: true,
        }),
      )
      props.push(
        makeProp(
          `crownV_${x}_${Math.round(z)}`,
          { x: x + outward * CROWN_OFFSET, y: 0, z },
          wallCrown(false, length),
          { noFade: true },
        ),
      )
    })
  }

  for (const g of GATES) {
    props.push(
      makeProp(`gate_${g.side}`, { x: g.x, y: 0, z: g.z }, gatehouse(g.horizontal, g.outward), {
        collider: g.horizontal ? { w: GATE_FOOT, d: WALL_T + 8 } : { w: WALL_T + 8, d: GATE_FOOT },
        shadow: GATE_W * 0.45,
        noFade: true,
      }),
    )

    // Braziers flanking the approach, on the inward side.
    const inward = -g.outward * 54
    for (const [name, off] of [
      ['L', -52],
      ['R', 52],
    ] as const) {
      props.push(
        makeProp(
          `brazier_${g.side}${name}`,
          {
            x: g.horizontal ? g.x + off : g.x + inward,
            y: 0,
            z: g.horizontal ? g.z + inward : g.z + off,
          },
          brazier(),
          { collider: { w: 14, d: 14 }, shadow: 9, noFade: true },
        ),
      )
    }
  }

  return props
}
