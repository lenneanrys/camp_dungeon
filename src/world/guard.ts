import { buildParts } from '../render3d/model'
import type { ModelPart, Costume } from '../render3d/model'
import type { Pose } from '../render3d/scene'
import type { V3 } from '../render3d/vec3'
import { walkingPose, walkBob } from '../render3d/pose'
import { NO_ROTATION } from '../render3d/rotation'
import { shortestAngleDelta } from './npc'
import {
  WALL,
  GATES,
  WALKWAY_Y,
  WALKWAY_INSET,
  TOWER_FOOT,
  GATE_FLANK,
  GATE_HEIGHT,
} from './fortifications'

/**
 * The garrison.
 *
 * Sentries pace the wall walkway, pairs stand each gate, and patrols work the
 * streets. They ease round corners rather than pivoting on the spot, and pause
 * at each waypoint — a soldier who never stops reads as a wind-up toy.
 */

const GUARD: Costume = {
  name: 'Guard',
  colors: {
    skin: '#b8804f',
    hair: '#3a2c1e',
    shirt: '#4a4f57',
    vest: '#2f3a52', // livery over mail
    pants: '#3a3f47',
    boots: '#2a231c',
    hat: '#6a7079', // steel helm
    hatBand: '#2f3a52',
    eye: '#1a1410',
  },
}

const SERGEANT: Costume = {
  name: 'Sergeant',
  colors: {
    ...GUARD.colors,
    skin: '#a9673d',
    vest: '#7a2f2a', // captain's red
    hat: '#8a9099',
    hatBand: '#7a2f2a',
  },
}

export interface Guard {
  id: string
  parts: ModelPart[]
  pos: { x: number; z: number }
  /** Height above the ground: 0 in the streets, walkway height on the wall. */
  elevation: number
  yaw: number
  path: { x: number; z: number }[]
  leg: number
  distance: number
  speed: number
  pause: number
  pauseFor: number
}

const TURN_RATE = 2.6
const ARRIVE = 6

/** How far along a wall run the sentries pace, clear of the towers. */
const RUN_INSET = TOWER_FOOT / 2 + 30

/**
 * How far inside a gate its guards stand.
 *
 * Derived, not guessed: a guard's feet project to `z x sin(PITCH)` and the top
 * of a wall of height `h` projects to `z_wall x sin(PITCH) - h x cos(PITCH)`.
 * At 45 degrees those factors are equal, so the feet clear the parapet once the
 * guard stands more than the wall's own height inside it.
 */
export const GATE_STANDOFF = Math.ceil(GATE_HEIGHT) + 34

function make(
  id: string,
  costume: Costume,
  path: { x: number; z: number }[],
  opts: { elevation?: number; speed?: number; pauseFor?: number; yaw?: number; seed?: number },
): Guard {
  const start = path[0]!
  return {
    id,
    parts: buildParts(costume),
    pos: { ...start },
    elevation: opts.elevation ?? 0,
    yaw: opts.yaw ?? 0,
    path,
    leg: 1 % path.length,
    distance: (opts.seed ?? 0) * 2.7,
    speed: opts.speed ?? 32,
    pause: 0,
    pauseFor: opts.pauseFor ?? 1.4,
  }
}

/** Sentry beats along the walkway of each wall, on the inner half. */
function wallBeats(): { id: string; path: { x: number; z: number }[] }[] {
  const beats: { id: string; path: { x: number; z: number }[] }[] = []

  for (const g of GATES) {
    if (g.horizontal) {
      const z = g.z - g.outward * WALKWAY_INSET
      // One beat either side of the gate, running out toward the corner.
      beats.push({
        id: `${g.side}W`,
        path: [
          { x: WALL.minX + RUN_INSET, z },
          { x: g.x - GATE_FLANK - RUN_INSET, z },
        ],
      })
      beats.push({
        id: `${g.side}E`,
        path: [
          { x: g.x + GATE_FLANK + RUN_INSET, z },
          { x: WALL.maxX - RUN_INSET, z },
        ],
      })
    } else {
      const x = g.x - g.outward * WALKWAY_INSET
      beats.push({
        id: `${g.side}N`,
        path: [
          { x, z: WALL.minZ + RUN_INSET },
          { x, z: g.z - GATE_FLANK - RUN_INSET },
        ],
      })
      beats.push({
        id: `${g.side}S`,
        path: [
          { x, z: g.z + GATE_FLANK + RUN_INSET },
          { x, z: WALL.maxZ - RUN_INSET },
        ],
      })
    }
  }
  return beats
}

/** Street patrol loop, inset well clear of the wall. */
function streetLoop(inset: number): { x: number; z: number }[] {
  return [
    { x: WALL.minX + inset, z: WALL.minZ + inset },
    { x: WALL.maxX - inset, z: WALL.minZ + inset },
    { x: WALL.maxX - inset, z: WALL.maxZ - inset },
    { x: WALL.minX + inset, z: WALL.maxZ - inset },
  ]
}

const rotate = <T,>(items: T[], by: number): T[] => [
  ...items.slice(by % items.length),
  ...items.slice(0, by % items.length),
]

export function buildGuards(): Guard[] {
  const guards: Guard[] = []

  // Sentries on the wall — two per side, walking the parapet.
  wallBeats().forEach((beat, i) => {
    guards.push(
      make(`wall_${beat.id}`, i % 5 === 0 ? SERGEANT : GUARD, beat.path, {
        elevation: WALKWAY_Y,
        speed: 26 + (i % 4) * 3,
        pauseFor: 1.6 + (i % 3) * 0.7,
        seed: i,
      }),
    )
  })

  // A pair standing every gate, shuffling on a short beat.
  //
  // They stand well back from the arch: the gatehouse is 72 units tall, so
  // anyone closer than ~74 units has their legs covered by it on screen. This
  // is geometry, not sorting — no draw order can save a guard standing behind
  // a wall taller than he is.
  GATES.forEach((g, i) => {
    const inward = -g.outward * GATE_STANDOFF
    for (const [k, off] of [-40, 40].entries()) {
      const x = g.horizontal ? g.x + off : g.x + inward
      const z = g.horizontal ? g.z + inward : g.z + off
      const step = g.horizontal ? { x, z: z - g.outward * 22 } : { x: x - g.outward * 22, z }
      guards.push(
        make(`gate_${g.side}${k}`, k === 0 ? SERGEANT : GUARD, [{ x, z }, step], {
          speed: 15,
          pauseFor: 3 + i * 0.6 + k,
          yaw: Math.atan2(-g.outward * (g.horizontal ? 0 : 1), -g.outward * (g.horizontal ? 1 : 0)),
          seed: i * 2 + k,
        }),
      )
    }
  })

  // Street patrols, each starting on a different corner at its own pace.
  for (let i = 0; i < 4; i++) {
    guards.push(
      make(`street${i}`, GUARD, rotate(streetLoop(96), i), {
        speed: 33 + i * 3,
        pauseFor: 1.2 + i * 0.5,
        seed: i + 9,
      }),
    )
  }

  return guards
}

export function updateGuard(guard: Guard, dt: number): void {
  const target = guard.path[guard.leg]!

  if (guard.pause > 0) {
    guard.pause = Math.max(0, guard.pause - dt)
    return
  }

  const dx = target.x - guard.pos.x
  const dz = target.z - guard.pos.z
  const dist = Math.hypot(dx, dz)

  if (dist <= ARRIVE) {
    guard.leg = (guard.leg + 1) % guard.path.length
    guard.pause = guard.pauseFor
    return
  }

  const want = Math.atan2(dx, dz)
  guard.yaw += shortestAngleDelta(guard.yaw, want) * Math.min(1, TURN_RATE * dt)

  const step = Math.min(guard.speed * dt, dist)
  guard.pos.x += (dx / dist) * step
  guard.pos.z += (dz / dist) * step
  guard.distance += step / 16 // model units to world units, for the gait
}

export const guardMoving = (guard: Guard): boolean => guard.pause <= 0

export function guardPose(guard: Guard): Pose {
  if (!guardMoving(guard)) {
    return { root: { x: 0, y: guard.yaw, z: 0 }, torso: { ...NO_ROTATION } }
  }
  return walkingPose(guard.distance, guard.yaw)
}

/**
 * The walk bob only. Elevation is NOT applied here — it goes into the guard's
 * position, so the camera projects it and the depth sort accounts for it.
 *
 * Treating height as a pure render offset put a sentry's sort depth on the
 * floor, so the wall he was standing on drew straight over the top of him.
 */
export function guardOffset(guard: Guard): V3 {
  return { x: 0, y: guardMoving(guard) ? walkBob(guard.distance) : 0, z: 0 }
}
