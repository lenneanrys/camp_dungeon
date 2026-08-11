import type { ModelPart } from '../render3d/model'
import type { Pose } from '../render3d/scene'
import { NO_ROTATION } from '../render3d/rotation'
import { PALETTE, tint } from './palette'
import { b } from './buildings'
import type { Target } from '../sim/combat'
import { DUMMY_SPOTS } from './village'

/**
 * A straw training dummy: a post, cross-arms, a stuffed body and a sack head.
 *
 * It is a ModelPart tree rather than a static prop because it has to rock back
 * when hit — and a rock-back is a rotation about its base, which is exactly
 * what the part system already does.
 */

const TILE = 16 // model units per world unit

export interface Dummy extends Target {
  id: string
  parts: ModelPart[]
}

/** Where the body is lashed to the post — the joint the dummy folds at. */
const MOUNT_Y = 22

function dummyParts(): ModelPart[] {
  return [
    {
      id: 'root',
      pivot: { x: 0, y: 0, z: 0 },
      rotation: { ...NO_ROTATION },
      cuboids: [],
    },
    {
      // The post is driven into the ground. It never rotates — a training
      // dummy that swings from its base is a dummy that isn't nailed down.
      id: 'legL',
      pivot: { x: 0, y: 0, z: 0 },
      rotation: { ...NO_ROTATION },
      cuboids: [
        b('dPost', 0, 0, 0, 5, 26, 5, PALETTE.timberDark),
        b('dCollar', 0, MOUNT_Y - 2, 0, 7, 3, 7, PALETTE.rope),
      ],
    },
    {
      // Only what is lashed above the collar takes the punch.
      id: 'torso',
      pivot: { x: 0, y: MOUNT_Y, z: 0 },
      rotation: { ...NO_ROTATION },
      cuboids: [
        b('dArms', 0, 26, 0, 40, 4, 4, PALETTE.timber),
        b('dBody', 0, 20, 0, 16, 18, 12, PALETTE.straw),
        b('dBodyBand', 0, 24, 0, 17, 2, 13, PALETTE.rope),
        b('dBodyBand2', 0, 30, 0, 17, 2, 13, PALETTE.rope),
        b('dShoulderL', -14, 24, 0, 8, 8, 8, tint(PALETTE.straw, -0.08)),
        b('dShoulderR', 14, 24, 0, 8, 8, 8, tint(PALETTE.straw, -0.08)),
        b('dNeck', 0, 38, 0, 4, 3, 4, PALETTE.rope),
        b('dHead', 0, 41, 0, 11, 11, 11, tint(PALETTE.straw, 0.08)),
        // A painted face so you can tell which way it is looking.
        {
          id: 'dFace',
          pos: { x: 0, y: 46, z: 5.7 },
          size: { w: 6, h: 4, d: 0.5 },
          color: PALETTE.timberDark,
          decal: true,
        },
        b('dStrawTop', 0, 46.5, 0, 9, 3, 9, PALETTE.straw),
      ],
    },
  ]
}

export function buildDummies(): Dummy[] {
  return DUMMY_SPOTS.map((spot, i) => ({
    id: `dummy${i}`,
    parts: dummyParts(),
    pos: { x: spot.x / TILE, y: spot.z / TILE },
    radius: 0.85,
    lastHitSwing: -1,
    hitTimer: 0,
    facingHit: { x: 0, y: 0 },
  }))
}

const ROCK_ANGLE = 0.55
const ROCK_DURATION = 0.32

/**
 * Rock away from the punch and spring back. Peaks immediately and eases out,
 * because the impact should read as instant and the recovery slow.
 *
 * The fold is expressed as pitch and roll rather than by spinning the whole
 * dummy to face the blow — yawing it would make the painted face jump around
 * every time you hit it from a different side.
 */
export function dummyPose(dummy: Dummy): Pose {
  if (dummy.hitTimer <= 0) return { root: { ...NO_ROTATION }, torso: { ...NO_ROTATION } }

  const t = dummy.hitTimer / ROCK_DURATION // 1 at impact, 0 when settled
  // Peaks at the instant of impact and decays with a single overshoot, rather
  // than easing straight back. Driven off cos so it starts at full fold — sin
  // would start the swing at the wrong end and fold INTO the punch.
  const amount = Math.cos((1 - t) * Math.PI * 1.5) * t * ROCK_ANGLE

  // Fold along the direction the punch travelled. The body sits above its
  // joint, so pitching forward is positive and rolling right is negative.
  return {
    root: { ...NO_ROTATION },
    torso: { x: amount * dummy.facingHit.y, y: 0, z: -amount * dummy.facingHit.x },
  }
}
