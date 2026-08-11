import type { PartCuboid } from '../render3d/model'
import type { Prop, AABB } from './prop'
import { makeProp } from './prop'
import { PALETTE, tint } from './palette'
import { b, decal, gableRoof } from './buildings'

/**
 * Buildings you can walk into.
 *
 * The trick is that there is no interior "scene" and no loading — a house is
 * just four walls with a gap in the front one. You walk through the gap. The
 * roof hides while you are inside, and the front wall fades because it stands
 * between you and the camera, which the occlusion pass already handles.
 */

export const WALL_T = 6 // wall thickness
export const DOOR_W = 24 // wide enough for a 10-unit-wide player, comfortably

/**
 * A piece of furniture: its geometry, and optionally the footprint you cannot
 * walk through. Keeping the two together is what stops them drifting apart —
 * a separate list of collider positions goes stale the moment anyone nudges a
 * bed.
 */
export interface Furnishing {
  cuboids: PartCuboid[]
  /** Footprint relative to the building centre. Omit for rugs and the like. */
  collider?: { x: number; z: number; w: number; d: number }
}

export interface BuildingSpec {
  id: string
  x: number
  z: number
  w: number
  d: number
  wallH: number
  wall: string
  trim: string
  roof: string
  floor: string
  /** Furniture, positioned relative to the building centre. */
  interior?: Furnishing[]
  /** Extra outdoor decoration attached to the shell. */
  exterior?: PartCuboid[]
}

/**
 * Place furniture at a spot inside a building, optionally solid.
 *
 * Pass `solid` for anything with legs or a frame; leave it off for rugs, which
 * you should be able to stand on.
 */
export function put(
  cuboids: PartCuboid[],
  dx: number,
  dz: number,
  solid?: { w: number; d: number },
  dy = 0,
): Furnishing {
  const moved = cuboids.map((c) => ({
    ...c,
    id: `${c.id}_${Math.round(dx)}_${Math.round(dz)}`,
    pos: { x: c.pos.x + dx, y: c.pos.y + dy, z: c.pos.z + dz },
  }))
  return solid
    ? { cuboids: moved, collider: { x: dx, z: dz, w: solid.w, d: solid.d } }
    : { cuboids: moved }
}

/** World-space footprints of everything solid inside a building. */
export function interiorColliders(spec: BuildingSpec): AABB[] {
  const out: AABB[] = []
  for (const item of spec.interior ?? []) {
    if (!item.collider) continue
    const c = item.collider
    out.push({
      minX: spec.x + c.x - c.w / 2,
      maxX: spec.x + c.x + c.w / 2,
      minZ: spec.z + c.z - c.d / 2,
      maxZ: spec.z + c.z + c.d / 2,
    })
  }
  return out
}

/** The walkable box inside the walls. */
export function interiorRegion(spec: BuildingSpec): AABB {
  return {
    minX: spec.x - spec.w / 2 + WALL_T,
    maxX: spec.x + spec.w / 2 - WALL_T,
    minZ: spec.z - spec.d / 2 + WALL_T,
    maxZ: spec.z + spec.d / 2 - WALL_T,
  }
}

/** Where the doorway sits, in world units. */
export function doorway(spec: BuildingSpec): { x: number; z: number } {
  return { x: spec.x, z: spec.z + spec.d / 2 }
}

export const roofId = (spec: BuildingSpec): string => `${spec.id}_roof`

/**
 * The pieces that get out of your way while you are inside: the roof, and the
 * front wall standing between you and the camera. Everything else stays solid,
 * so the room still reads as a room.
 */
export const shellIds = (spec: BuildingSpec): string[] => [
  roofId(spec),
  `${spec.id}_wallSL`,
  `${spec.id}_wallSR`,
  `${spec.id}_lintel`,
]

/**
 * Sort nudges for pieces that share a footprint. Ground-position sorting
 * cannot separate a roof from the furniture beneath it — they stand on the
 * same spot — so the tie is broken deliberately here. Without this the
 * furniture paints straight over the roof.
 */
const BIAS = { floor: -8, interior: -4, roof: 8 }

/**
 * Walls, floor, roof and contents, as separate props.
 *
 * Separate rather than one prop because each wall needs its own collider — a
 * single box collider would seal the doorway shut — and because the scene
 * sorts per object, so the wall you are standing behind must be its own thing.
 */
export function buildingProps(spec: BuildingSpec): Prop[] {
  const { id, x, z, w, d, wallH } = spec
  const half = { w: w / 2, d: d / 2 }
  const out: Prop[] = []

  const wallCuboid = (name: string, ww: number, hh: number, dd: number): PartCuboid[] => [
    b(`${id}${name}`, 0, 0, 0, ww, hh, dd, spec.wall),
    // A timber sill along the top gives the wall a finished edge.
    b(`${id}${name}Top`, 0, hh - 3, 0, ww + 1, 3, dd + 1, spec.trim),
  ]

  // Floor: purely visual, and slightly inset so it never z-fights the walls.
  out.push(
    makeProp(
      `${id}_floor`,
      { x, y: 0, z },
      [b(`${id}Floor`, 0, 0, 0, w - WALL_T * 2 + 1, 1, d - WALL_T * 2 + 1, spec.floor)],
      { depthBias: BIAS.floor },
    ),
  )

  // Back wall (north) and the two sides.
  out.push(
    makeProp(`${id}_wallN`, { x, y: 0, z: z - half.d + WALL_T / 2 }, wallCuboid('WallN', w, wallH, WALL_T), {
      collider: { w, d: WALL_T },
    }),
  )
  out.push(
    makeProp(
      `${id}_wallW`,
      { x: x - half.w + WALL_T / 2, y: 0, z },
      wallCuboid('WallW', WALL_T, wallH, d - WALL_T * 2),
      { collider: { w: WALL_T, d: d - WALL_T * 2 } },
    ),
  )
  out.push(
    makeProp(
      `${id}_wallE`,
      { x: x + half.w - WALL_T / 2, y: 0, z },
      wallCuboid('WallE', WALL_T, wallH, d - WALL_T * 2),
      { collider: { w: WALL_T, d: d - WALL_T * 2 } },
    ),
  )

  // Front wall in two pieces with the doorway between them.
  const sideW = (w - DOOR_W) / 2
  for (const [side, sx] of [
    ['L', -(DOOR_W / 2 + sideW / 2)],
    ['R', DOOR_W / 2 + sideW / 2],
  ] as const) {
    out.push(
      makeProp(
        `${id}_wallS${side}`,
        { x: x + sx, y: 0, z: z + half.d - WALL_T / 2 },
        [
          ...wallCuboid(`WallS${side}`, sideW, wallH, WALL_T),
          b(`${id}Win${side}`, 0, wallH - 22, WALL_T / 2, 11, 11, 1.5, spec.trim),
          decal(`${id}Glass${side}`, 0, wallH - 20.5, WALL_T / 2 + 1.2, 8, 8, PALETTE.glass),
        ],
        { collider: { w: sideW, d: WALL_T } },
      ),
    )
  }

  // Lintel over the doorway, so the gap reads as a door rather than a hole.
  out.push(
    makeProp(`${id}_lintel`, { x, y: 0, z: z + half.d - WALL_T / 2 }, [
      b(`${id}Lintel`, 0, 30, 0, DOOR_W + 6, wallH - 30, WALL_T, spec.wall),
      b(`${id}LintelBeam`, 0, 27, 0, DOOR_W + 8, 3, WALL_T + 2, PALETTE.timberDark),
    ]),
  )

  // Roof — no collider, and hidden entirely while you are inside.
  out.push(
    makeProp(
      roofId(spec),
      { x, y: 0, z },
      gableRoof({ w, d, wallH, wall: spec.wall, trim: spec.trim, roof: spec.roof }, `${id}R`),
      { shadow: w * 0.45, depthBias: BIAS.roof },
    ),
  )

  if (spec.interior?.length) {
    out.push(
      makeProp(`${id}_interior`, { x, y: 0, z }, spec.interior.flatMap((f) => f.cuboids), {
        depthBias: BIAS.interior,
      }),
    )
  }
  if (spec.exterior?.length) {
    out.push(makeProp(`${id}_exterior`, { x, y: 0, z }, spec.exterior))
  }

  return out
}

// ------------------------------------------------------------- furniture ---

export function table(): PartCuboid[] {
  return [
    b('tableTop', 0, 14, 0, 30, 3, 18, PALETTE.timber),
    b('tableLegA', -12, 0, -6, 3, 14, 3, tint(PALETTE.timber, -0.2)),
    b('tableLegB', 12, 0, -6, 3, 14, 3, tint(PALETTE.timber, -0.2)),
    b('tableLegC', -12, 0, 6, 3, 14, 3, tint(PALETTE.timber, -0.2)),
    b('tableLegD', 12, 0, 6, 3, 14, 3, tint(PALETTE.timber, -0.2)),
  ]
}

export function chair(prefix: string): PartCuboid[] {
  return [
    b(`${prefix}Seat`, 0, 11, 0, 13, 3, 13, PALETTE.timber),
    b(`${prefix}LegA`, -5, 0, -5, 2.5, 11, 2.5, tint(PALETTE.timber, -0.25)),
    b(`${prefix}LegB`, 5, 0, -5, 2.5, 11, 2.5, tint(PALETTE.timber, -0.25)),
    b(`${prefix}LegC`, -5, 0, 5, 2.5, 11, 2.5, tint(PALETTE.timber, -0.25)),
    b(`${prefix}LegD`, 5, 0, 5, 2.5, 11, 2.5, tint(PALETTE.timber, -0.25)),
    b(`${prefix}Back`, 0, 14, -5.5, 13, 14, 2.5, PALETTE.timber),
    b(`${prefix}BackTop`, 0, 26, -5.5, 13, 2.5, 3.5, tint(PALETTE.timber, -0.15)),
  ]
}

export function stool(prefix: string): PartCuboid[] {
  return [
    b(`${prefix}Seat`, 0, 10, 0, 10, 2.5, 10, PALETTE.timber),
    b(`${prefix}Leg`, 0, 0, 0, 7, 10, 7, tint(PALETTE.timber, -0.25)),
  ]
}

export function bed(): PartCuboid[] {
  return [
    b('bedFrame', 0, 0, 0, 22, 8, 38, PALETTE.timberDark),
    b('bedMattress', 0, 8, 0, 20, 5, 34, PALETTE.plaster),
    b('bedBlanket', 0, 12, 6, 21, 3, 22, PALETTE.cloth),
    b('bedPillow', 0, 13, -13, 14, 4, 8, PALETTE.clothAlt),
  ]
}

/**
 * The same bed turned side-on, for standing against a side wall.
 *
 * A 38-deep bed running front-to-back eats most of a small room and ends up
 * in the doorway; along the wall it leaves the floor clear.
 */
export function bedSideways(): PartCuboid[] {
  return [
    b('bedSFrame', 0, 0, 0, 38, 8, 22, PALETTE.timberDark),
    b('bedSMattress', 0, 8, 0, 34, 5, 20, PALETTE.plaster),
    b('bedSBlanket', 6, 12, 0, 22, 3, 21, PALETTE.cloth),
    b('bedSPillow', -13, 13, 0, 8, 4, 14, PALETTE.clothAlt),
  ]
}

export function fireplace(): PartCuboid[] {
  return [
    b('hearth', 0, 0, 0, 30, 26, 12, PALETTE.stone),
    b('hearthGap', 0, 2, 5, 18, 16, 6, '#241a12'),
    b('hearthFire', 0, 2, 5, 12, 7, 5, '#c4531f'),
    b('hearthMantel', 0, 26, 0, 34, 4, 15, PALETTE.timber),
  ]
}

export function rug(color: string): PartCuboid[] {
  return [
    b('rug', 0, 0.6, 0, 34, 0.8, 26, color),
    b('rugTrim', 0, 0.7, 0, 30, 0.9, 22, tint(color, 0.18)),
  ]
}

export function shelf(prefix: string): PartCuboid[] {
  return [
    b(`${prefix}Back`, 0, 0, 0, 26, 34, 4, PALETTE.timberDark),
    b(`${prefix}A`, 0, 12, 3, 26, 2, 8, PALETTE.timber),
    b(`${prefix}B`, 0, 24, 3, 26, 2, 8, PALETTE.timber),
    b(`${prefix}BookA`, -8, 14, 3, 4, 8, 7, PALETTE.roofTile),
    b(`${prefix}BookB`, -3, 14, 3, 4, 9, 7, PALETTE.roofBlue),
    b(`${prefix}BookC`, 2, 14, 3, 4, 7, 7, PALETTE.leaf),
    b(`${prefix}PotA`, 6, 26, 3, 6, 7, 6, PALETTE.copper),
  ]
}

export function chest(): PartCuboid[] {
  return [
    b('chestBody', 0, 0, 0, 20, 12, 13, PALETTE.timber),
    b('chestLid', 0, 12, 0, 21, 4, 14, tint(PALETTE.timber, -0.15)),
    b('chestLock', 0, 11, 7, 4, 5, 2, PALETTE.copper),
    b('chestBandL', -6, 0, 0, 2.5, 16, 14, PALETTE.iron),
    b('chestBandR', 6, 0, 0, 2.5, 16, 14, PALETTE.iron),
  ]
}

export function lantern(prefix: string): PartCuboid[] {
  return [
    b(`${prefix}Base`, 0, 0, 0, 6, 2, 6, PALETTE.iron),
    b(`${prefix}Glass`, 0, 2, 0, 5, 7, 5, PALETTE.straw),
    b(`${prefix}Cap`, 0, 9, 0, 7, 2, 7, PALETTE.iron),
  ]
}

/** Move a set of cuboids without rebuilding them. */
export function place(cuboids: PartCuboid[], dx: number, dy: number, dz: number): PartCuboid[] {
  return cuboids.map((c) => ({
    ...c,
    id: `${c.id}_${Math.round(dx)}_${Math.round(dz)}`,
    pos: { x: c.pos.x + dx, y: c.pos.y + dy, z: c.pos.z + dz },
  }))
}
