import { buildParts } from '../render3d/model'
import type { ModelPart, Costume } from '../render3d/model'
import type { Pose } from '../render3d/scene'
import type { V3 } from '../render3d/vec3'
import { STATIONS } from './village'

/**
 * NPCs reuse the player's part tree with a different costume — the model was
 * built to be recoloured, so a townsperson costs a colour table rather than a
 * new model.
 *
 * No interaction yet: they stand at their stations and look alive.
 */

export interface Npc {
  id: string
  parts: ModelPart[]
  pos: V3
  facing: { x: number; y: number }
  /** Phase offset so no two NPCs breathe in lockstep. */
  phase: number
  /** The way this NPC faces when left alone. */
  homeYaw: number
  /** Current facing, eased toward whatever it wants to look at. */
  yaw: number
  /** 0 when idle, 1 when locked onto the player — used to steady the gaze. */
  attention: number
}

const COSTUMES: Record<string, Costume> = {
  blacksmith: {
    name: 'Blacksmith',
    colors: {
      skin: '#a9673d',
      hair: '#2e2118',
      shirt: '#6d6055',
      vest: '#4a3526', // leather apron
      pants: '#3f3830',
      boots: '#2c2119',
      hat: '#4a3526',
      hatBand: '#2c2119',
      eye: '#1a1410',
    },
  },
  alchemist: {
    name: 'Alchemist',
    colors: {
      skin: '#d3a06a',
      hair: '#8a8f95',
      shirt: '#e2ddcd',
      vest: '#5f8f6b', // herb-green robe
      pants: '#4c6b55',
      boots: '#3c3228',
      hat: '#5f8f6b',
      hatBand: '#c9a95d',
      eye: '#241a12',
    },
  },
  enchanter: {
    name: 'Enchanter',
    colors: {
      skin: '#c2926a',
      hair: '#d8d3e6',
      shirt: '#3a3350',
      vest: '#4a3f7a', // deep violet
      pants: '#2f2a44',
      boots: '#241f36',
      hat: '#4a3f7a',
      hatBand: '#8ad4ff',
      eye: '#1a1626',
    },
  },
  merchant: {
    name: 'Merchant',
    colors: {
      skin: '#b8804f',
      hair: '#4a3220',
      shirt: '#e6d9b8',
      vest: '#a8412f', // bright market red
      pants: '#7a5433',
      boots: '#4a3120',
      hat: '#a8412f',
      hatBand: '#d4a13c',
      eye: '#241a12',
    },
  },
}

export function buildNpcs(): Npc[] {
  return STATIONS.map((station, i) => {
    const homeYaw = Math.atan2(station.facing.x, station.facing.y)
    return {
      id: station.id,
      parts: buildParts(COSTUMES[station.id] ?? COSTUMES.merchant!),
      pos: { x: station.x, y: 0, z: station.z },
      facing: station.facing,
      // Irrational spacing so the cycles never re-synchronise.
      phase: i * 1.7 + 0.4,
      homeYaw,
      yaw: homeYaw,
      attention: 0,
    }
  })
}

/** Four tiles, in model units. */
export const LOOK_RADIUS = 4 * 16
/** How fast a head comes round. Low enough to read as a turn, not a snap. */
export const TURN_RATE = 3.4
const ATTENTION_RATE = 4

/**
 * Signed angle from `from` to `to`, wrapped into [-PI, PI].
 *
 * Without the wrap, turning from 179 degrees to -179 degrees takes the long
 * way round — the NPC spins almost a full circle to look two degrees left.
 */
export function shortestAngleDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return delta
}

/** Ease `current` toward `target`, never overshooting. */
export function turnToward(current: number, target: number, dt: number, rate: number): number {
  return current + shortestAngleDelta(current, target) * Math.min(1, rate * dt)
}

/**
 * Turn to watch the player when they come close, and drift back to the
 * station's own facing when they leave. Both are eased — a head that snaps
 * round reads as a glitch rather than as noticing you.
 */
export function updateNpc(npc: Npc, playerPos: { x: number; z: number }, dt: number): void {
  const dx = playerPos.x - npc.pos.x
  const dz = playerPos.z - npc.pos.z
  const near = Math.hypot(dx, dz) <= LOOK_RADIUS

  const target = near ? Math.atan2(dx, dz) : npc.homeYaw
  npc.yaw = turnToward(npc.yaw, target, dt, TURN_RATE)

  // Attention fades in and out too, so the idle head-glance stops while they
  // are looking at you and resumes once you wander off.
  const want = near ? 1 : 0
  npc.attention += (want - npc.attention) * Math.min(1, ATTENTION_RATE * dt)
}

const BREATH_RATE = 1.1 // radians per second
const LOOK_RATE = 0.27

/** Slow breathing, and an idle glance that stops while they are watching you. */
export function npcPose(npc: Npc, seconds: number): Pose {
  const t = seconds + npc.phase
  const breath = Math.sin(t * BREATH_RATE)
  // Idle wandering of the gaze fades out as attention rises.
  const look = Math.sin(t * LOOK_RATE) * (1 - npc.attention)

  return {
    root: { x: 0, y: npc.yaw, z: 0 },
    torso: { x: breath * 0.015, y: look * 0.06, z: 0 },
    head: { x: breath * 0.02, y: look * 0.34, z: 0 },
    // Arms drift almost imperceptibly, which reads as alive rather than frozen.
    armL: { x: breath * 0.05, y: 0, z: 0 },
    armR: { x: -breath * 0.05, y: 0, z: 0 },
    legL: { x: 0, y: 0, z: 0 },
    legR: { x: 0, y: 0, z: 0 },
  }
}

/** Vertical bob, applied to the whole body like the player's walk bob. */
export function npcOffset(npc: Npc, seconds: number): V3 {
  return { x: 0, y: Math.sin((seconds + npc.phase) * BREATH_RATE) * 0.35, z: 0 }
}
