import type { Player } from '../sim/player'
import type { PartId } from './model'
import type { Rotation } from './rotation'
import type { V3 } from './vec3'

/**
 * Animation is nothing but joint angles. No part is ever repositioned, which
 * is precisely why limbs cannot detach, boots cannot climb the shin, and the
 * roll works in every direction: everything is a rotation about a real joint.
 */

const WALK_FREQUENCY = 3.2 // radians per world unit travelled
const LEG_SWING = 0.75
const ARM_SWING_RATIO = 0.85
const HIP_SWAY = 0.09
const TORSO_LEAN = 0.1
const BOB_HEIGHT = 0.8

// Hanging limbs sit BELOW their joint, so a negative pitch swings them
// forward. -PI/2 puts an arm exactly horizontal, pointing straight ahead.
const PUNCH_ANGLE = -Math.PI / 2
// The torso sits ABOVE its pivot, so a POSITIVE pitch leans it into the punch.
const PUNCH_LEAN = 0.2
/**
 * Reach comes from the shoulder as much as the arm. Twisting the torso drives
 * the punching shoulder forward and pulls the other one back — which is how a
 * real jab gains its extra reach, and it stays a pure rotation.
 */
const PUNCH_TWIST = 0.5

// The tuck. Real angles, so the body genuinely curls into a ball.
//
// Signs differ by part, and it matters: arms and legs hang BELOW their joint,
// so forward is negative. The torso and head sit ABOVE theirs, so forward is
// positive. Using one sign for all of them curls the body backwards.
const TUCK_IN = 0.18 // fraction of the roll spent curling in and out
// Found by grid search (see tuckSearch.test.ts), not by guessing: these give a
// ball of radius 6.7 model units at 48% of standing height. Note the shape is
// counterintuitive — a SHALLOW waist fold with a DEEP head tuck beats a deep
// waist fold, because folding the spine hard swings the head out horizontally
// instead of drawing it in.
const TUCK_HIP = -2.0 // knees up to the chest
const TUCK_SHOULDER = -0.6 // hands down onto the shins
const TUCK_TORSO = 0.6 // slight fold at the waist
const TUCK_HEAD = 1.6 // chin hard to the chest

const ZERO: Rotation = { x: 0, y: 0, z: 0 }

/** Ramps 0 → 1 → 0 across the roll, so he curls up and stands back up. */
export function tuckAmount(progress: number): number {
  if (progress < TUCK_IN) return progress / TUCK_IN
  if (progress > 1 - TUCK_IN) return (1 - progress) / TUCK_IN
  return 1
}

const punchExtend = (progress: number): number =>
  progress < 0.35 ? progress / 0.35 : 1 - (progress - 0.35) / 0.65

/**
 * The walk cycle on its own, for anyone who is not the player — patrolling
 * guards use exactly the same gait, so the town moves as one piece of animation
 * rather than two that almost match.
 */
export function walkingPose(distanceTravelled: number, yaw: number): Partial<Record<PartId, Rotation>> {
  const phase = distanceTravelled * WALK_FREQUENCY
  const swing = Math.sin(phase) * LEG_SWING
  return {
    root: { x: 0, y: yaw, z: 0 },
    legL: { x: swing, y: 0, z: 0 },
    legR: { x: -swing, y: 0, z: 0 },
    armL: { x: -swing * ARM_SWING_RATIO, y: 0, z: 0 },
    armR: { x: swing * ARM_SWING_RATIO, y: 0, z: 0 },
    torso: { x: TORSO_LEAN, y: Math.sin(phase * 2) * HIP_SWAY, z: 0 },
    head: { x: 0, y: 0, z: 0 },
  }
}

/** The bob that goes with `walkingPose`. */
export function walkBob(distanceTravelled: number): number {
  return Math.abs(Math.sin(distanceTravelled * WALK_FREQUENCY)) * BOB_HEIGHT
}

/** Vertical bob, applied to the whole body rather than to any joint. */
export function rootOffset(player: Player): V3 {
  if (!player.isMoving || player.state === 'rolling') return { x: 0, y: 0, z: 0 }
  const phase = player.distanceTravelled * WALK_FREQUENCY
  return { x: 0, y: Math.abs(Math.sin(phase)) * BOB_HEIGHT, z: 0 }
}

export function poseFor(player: Player): Partial<Record<PartId, Rotation>> {
  const yaw = Math.atan2(player.facing.x, player.facing.y)
  const pose: Partial<Record<PartId, Rotation>> = {
    root: { x: 0, y: yaw, z: 0 },
    torso: { ...ZERO },
    head: { ...ZERO },
    armL: { ...ZERO },
    armR: { ...ZERO },
    legL: { ...ZERO },
    legR: { ...ZERO },
  }

  if (player.state === 'rolling') {
    const t = tuckAmount(player.rollProgress)
    pose.legL = { x: TUCK_HIP * t, y: 0, z: 0 }
    pose.legR = { x: TUCK_HIP * t, y: 0, z: 0 }
    pose.armL = { x: TUCK_SHOULDER * t, y: 0, z: 0 }
    pose.armR = { x: TUCK_SHOULDER * t, y: 0, z: 0 }
    pose.torso = { x: TUCK_TORSO * t, y: 0, z: 0 }
    pose.head = { x: TUCK_HEAD * t, y: 0, z: 0 }
    // The somersault itself: the whole tucked body goes over forward.
    pose.root = { x: player.rollProgress * Math.PI * 2, y: yaw, z: 0 }
    return pose
  }

  if (player.isMoving) {
    const phase = player.distanceTravelled * WALK_FREQUENCY
    const swing = Math.sin(phase) * LEG_SWING
    pose.legL = { x: swing, y: 0, z: 0 }
    pose.legR = { x: -swing, y: 0, z: 0 }
    pose.armL = { x: -swing * ARM_SWING_RATIO, y: 0, z: 0 }
    pose.armR = { x: swing * ARM_SWING_RATIO, y: 0, z: 0 }
    // Hips sway at double the stride rate, and he leans INTO the walk. The
    // torso sits above its pivot, so forward is positive — this was negative,
    // which leaned him away from the direction he was heading.
    pose.torso = { x: TORSO_LEAN, y: Math.sin(phase * 2) * HIP_SWAY, z: 0 }
  }

  if (player.state === 'attacking') {
    const extension = punchExtend(player.attackProgress)
    const arm: PartId = player.swingCount % 2 === 0 ? 'armL' : 'armR'
    pose[arm] = { x: PUNCH_ANGLE * extension, y: 0, z: 0 }
    // Twist toward the punching side: a left jab needs a positive yaw to bring
    // the left shoulder forward, a right one needs a negative yaw.
    pose.torso = {
      x: PUNCH_LEAN * extension,
      y: (arm === 'armL' ? PUNCH_TWIST : -PUNCH_TWIST) * extension,
      z: 0,
    }
  }

  return pose
}
