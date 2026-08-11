import type { Vec2 } from './vec2'
import type { Player } from './player'
import { ATTACK_DURATIONS, TICK } from './constants'

/**
 * Combat impact. Nothing here knows about rendering — the hitbox is geometry,
 * the feedback is state that the renderer reads.
 */

/** Fraction of a swing during which the fist can connect. */
export const STRIKE_START = 0.25
export const STRIKE_END = 0.55

/** How far in front of the player the fist lands, and how wide it reaches. */
export const FIST_REACH = 0.95 // world units
export const FIST_RADIUS = 0.75

/** Damage per combo step. The third swing is the heavy one. */
export const COMBO_DAMAGE = [7, 8, 14]

export const HITSTOP_SECONDS = 0.06

export interface Hitbox {
  pos: Vec2
  radius: number
}

/**
 * Where the fist is right now, or null if it is not swinging.
 *
 * Restricting this to the strike window is what makes a punch feel like it has
 * a moment of impact rather than a whole-swing damage aura.
 */
export function attackHitbox(player: Player): Hitbox | null {
  if (player.state !== 'attacking') return null
  const p = player.attackProgress
  if (p < STRIKE_START || p > STRIKE_END) return null

  return {
    pos: {
      x: player.pos.x + player.facing.x * FIST_REACH,
      y: player.pos.y + player.facing.y * FIST_REACH,
    },
    radius: FIST_RADIUS,
  }
}

export function comboDamage(comboStep: number): number {
  return COMBO_DAMAGE[comboStep] ?? COMBO_DAMAGE[0]!
}

/** How long the current swing lasts, for reference by callers. */
export const swingDuration = (comboStep: number): number =>
  ATTACK_DURATIONS[comboStep] ?? ATTACK_DURATIONS[0]!

export interface Target {
  pos: Vec2
  radius: number
  /** The swing number that last connected, so one swing lands once. */
  lastHitSwing: number
  /** Counts down; drives the rock-back animation. */
  hitTimer: number
  facingHit: Vec2
}

export interface HitResult {
  target: Target
  damage: number
  at: Vec2
}

/**
 * Resolve one tick of attacking against a set of targets.
 *
 * The `lastHitSwing` guard is the important part: without it a hitbox that is
 * live for a fifth of a second deals damage on every one of those ~12 ticks.
 */
export function resolveHits(player: Player, targets: Target[]): HitResult[] {
  const box = attackHitbox(player)
  if (!box) return []

  const out: HitResult[] = []
  for (const target of targets) {
    if (target.lastHitSwing === player.swingCount) continue

    const reach = box.radius + target.radius
    const dx = target.pos.x - box.pos.x
    const dy = target.pos.y - box.pos.y
    if (dx * dx + dy * dy > reach * reach) continue

    target.lastHitSwing = player.swingCount
    target.hitTimer = 0.32
    target.facingHit = { x: player.facing.x, y: player.facing.y }
    out.push({ target, damage: comboDamage(player.comboStep), at: { ...target.pos } })
  }
  return out
}

export interface FloatingNumber {
  value: number
  pos: Vec2
  age: number
  life: number
}

/**
 * Hit feedback: a damage number and a brief freeze.
 *
 * Deliberately no screenshake. It reads as impact on a monitor you are not
 * holding, but on a phone in your hands it just looks like the picture is
 * wobbling — the hitstop does the same job without the nausea.
 */
export class Feedback {
  numbers: FloatingNumber[] = []
  hitstop = 0

  onHit(hit: HitResult): void {
    this.numbers.push({ value: hit.damage, pos: { ...hit.at }, age: 0, life: 0.9 })
    this.hitstop = HITSTOP_SECONDS
  }

  /** Returns true if the sim should be frozen this tick. */
  tick(): boolean {
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - TICK)
      return true
    }

    for (const n of this.numbers) n.age += TICK
    // Rebuilding the array keeps it from growing without bound over a session.
    this.numbers = this.numbers.filter((n) => n.age < n.life)
    return false
  }
}

/** Advance a target's rock-back timer. */
export function tickTarget(target: Target): void {
  target.hitTimer = Math.max(0, target.hitTimer - TICK)
}
