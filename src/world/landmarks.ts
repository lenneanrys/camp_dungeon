import type { ModelPart, PartCuboid } from '../render3d/model'
import type { Pose } from '../render3d/scene'
import { NO_ROTATION } from '../render3d/rotation'
import { PALETTE, tint } from './palette'
import { b, decal } from './buildings'

/**
 * The centrepiece: a stone archway over the plaza with a signpost under it
 * pointing the way to everything in the village.
 *
 * The signpost is built from parts rather than plain cuboids because its arms
 * must point at real directions, including diagonals. It is baked once at load
 * with a fixed pose, so it costs no more per frame than any other prop.
 */

export function archway(): PartCuboid[] {
  const pillarH = 56
  const span = 46
  const out: PartCuboid[] = []

  for (const [side, sx] of [
    ['L', -span],
    ['R', span],
  ] as const) {
    out.push(b(`archBase${side}`, sx, 0, 0, 22, 6, 22, PALETTE.cobble))
    out.push(b(`archPillar${side}`, sx, 6, 0, 16, pillarH, 16, PALETTE.stone))
    out.push(b(`archCap${side}`, sx, pillarH + 6, 0, 21, 5, 21, PALETTE.cobble))
    // A little corbel where the arch springs from the pillar.
    out.push(
      b(`archCorbel${side}`, sx + (side === 'L' ? 10 : -10), pillarH - 2, 0, 12, 8, 14, PALETTE.stone),
    )
  }

  // The span itself, stepped so it reads as an arch rather than a lintel.
  const beamY = pillarH + 11
  out.push(b('archSpanLow', 0, beamY, 0, span * 2 - 8, 8, 18, PALETTE.stone))
  out.push(b('archSpanMid', 0, beamY + 8, 0, span * 2 + 6, 6, 20, PALETTE.cobble))
  out.push(b('archKeystone', 0, beamY + 14, 0, 16, 9, 22, tint(PALETTE.stone, 0.12)))
  out.push(decal('archGlyph', 0, beamY + 17, 11.2, 8, 5, PALETTE.copper))

  // Banners hanging from the span.
  out.push(b('archBannerL', -26, beamY - 16, 8, 12, 16, 1.6, PALETTE.cloth))
  out.push(b('archBannerR', 26, beamY - 16, 8, 12, 16, 1.6, PALETTE.roofBlue))

  // Braziers at the feet.
  for (const [side, sx] of [
    ['L', -span],
    ['R', span],
  ] as const) {
    out.push(b(`brazier${side}`, sx, 6, 20, 10, 12, 10, PALETTE.iron))
    out.push(b(`brazierFire${side}`, sx, 18, 20, 8, 5, 8, '#e07a2c'))
  }

  return out
}

export interface SignArm {
  /** Label colour — the destination's own colour, so it reads at a glance. */
  color: string
  /** Direction to point, in world x/z. */
  dir: { x: number; z: number }
  /** Height up the post. */
  y: number
}

const ARM_LENGTH = 30

/**
 * A signpost whose arms point at real destinations.
 *
 * Each arm is its own part, yawed to face its target — which is why this is a
 * part tree and not a flat cuboid list.
 */
export function signpost(arms: SignArm[]): { parts: ModelPart[]; pose: Pose } {
  const parts: ModelPart[] = [
    { id: 'root', pivot: { x: 0, y: 0, z: 0 }, rotation: { ...NO_ROTATION }, cuboids: [] },
    {
      id: 'post',
      pivot: { x: 0, y: 0, z: 0 },
      rotation: { ...NO_ROTATION },
      cuboids: [
        b('signBase', 0, 0, 0, 14, 4, 14, PALETTE.cobble),
        b('signPost', 0, 4, 0, 6, 62, 6, PALETTE.timber),
        b('signFinial', 0, 66, 0, 9, 5, 9, PALETTE.copper),
      ],
    },
  ]

  const pose: Pose = { root: { ...NO_ROTATION }, post: { ...NO_ROTATION } }

  arms.forEach((arm, i) => {
    const id = `arm${i}`
    parts.push({
      id,
      pivot: { x: 0, y: arm.y, z: 0 },
      rotation: { ...NO_ROTATION },
      cuboids: [
        // Authored pointing along +z; the pose yaws it toward its target.
        b(`${id}Plank`, 0, arm.y - 2, ARM_LENGTH / 2, 7, 4, ARM_LENGTH, PALETTE.timber),
        // The tip is a wedge, so it reads as an arrow.
        b(`${id}Tip`, 0, arm.y - 2, ARM_LENGTH + 3, 4, 4, 7, tint(PALETTE.timber, -0.2)),
        // Colour band identifying the destination.
        b(`${id}Band`, 0, arm.y - 2, ARM_LENGTH - 6, 7.6, 4.4, 8, arm.color),
      ],
    })
    pose[id] = { x: 0, y: Math.atan2(arm.dir.x, arm.dir.z), z: 0 }
  })

  return { parts, pose }
}

/** A board of notices beside the arch — pure flavour. */
export function noticeBoard(): PartCuboid[] {
  return [
    b('noticePostL', -16, 0, 0, 4, 34, 4, PALETTE.timber),
    b('noticePostR', 16, 0, 0, 4, 34, 4, PALETTE.timber),
    b('noticeBoard', 0, 18, 0, 38, 24, 3, PALETTE.timberDark),
    b('noticeRoof', 0, 42, 0, 44, 3, 10, PALETTE.thatch),
    decal('noticeA', -11, 24, 2, 10, 12, PALETTE.plaster),
    decal('noticeB', 2, 27, 2, 8, 9, '#e8dfc4'),
    decal('noticeC', 12, 22, 2, 9, 11, PALETTE.plaster),
  ]
}

/** A flower bed, for softening the plaza edges. */
export function flowerBed(colors: string[]): PartCuboid[] {
  const out: PartCuboid[] = [
    b('bedFrame', 0, 0, 0, 26, 6, 14, PALETTE.timber),
    b('bedSoil', 0, 6, 0, 24, 1.5, 12, PALETTE.dirt),
  ]
  colors.forEach((c, i) => {
    const x = -8 + i * 8
    out.push(b(`stem${i}`, x, 7, 0, 1.6, 6, 1.6, PALETTE.leaf))
    out.push(b(`bloom${i}`, x, 12, 0, 5, 4, 5, c))
  })
  return out
}

/** A water trough — the sort of thing a village actually has. */
export function trough(): PartCuboid[] {
  return [
    b('troughBody', 0, 0, 0, 34, 11, 15, PALETTE.timber),
    b('troughWater', 0, 8, 0, 30, 3, 11, '#4a7f96'),
    b('troughLegL', -13, 0, 0, 5, 3, 15, tint(PALETTE.timber, -0.25)),
    b('troughLegR', 13, 0, 0, 5, 3, 15, tint(PALETTE.timber, -0.25)),
  ]
}

/** Stacked firewood. */
export function woodpile(): PartCuboid[] {
  const out: PartCuboid[] = []
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4; i++) {
      out.push(
        b(
          `log${row}_${i}`,
          -12 + i * 8,
          row * 7,
          row % 2 === 0 ? 0 : 2,
          7,
          7,
          22,
          tint(PALETTE.timber, row % 2 === 0 ? 0 : -0.12),
        ),
      )
    }
  }
  return out
}

/** A cart, parked. */
export function cart(): PartCuboid[] {
  return [
    b('cartBed', 0, 12, 0, 40, 6, 24, PALETTE.timber),
    b('cartSideL', 0, 18, -11, 40, 10, 3, PALETTE.timber),
    b('cartSideR', 0, 18, 11, 40, 10, 3, PALETTE.timber),
    b('cartWheelL', -14, 0, -13, 4, 22, 22, PALETTE.timberDark),
    b('cartWheelR', -14, 0, 13, 4, 22, 22, PALETTE.timberDark),
    b('cartWheelL2', 14, 0, -13, 4, 22, 22, PALETTE.timberDark),
    b('cartWheelR2', 14, 0, 13, 4, 22, 22, PALETTE.timberDark),
    b('cartShaft', -28, 14, 0, 20, 4, 4, PALETTE.timber),
    b('cartSack', 4, 18, 0, 14, 12, 14, PALETTE.straw),
  ]
}
