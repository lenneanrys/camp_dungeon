import type { Vec2 } from './vec2'
import { normalize, scale, length } from './vec2'
import {
  TICK,
  WALK_SPEED,
  ROLL_DURATION,
  ROLL_SPEED_MULT,
  ROLL_TAIL_DURATION,
  ROLL_TAIL_MULT,
  ROLL_COOLDOWN,
  ATTACK_DURATIONS,
  ATTACK_COMBO_WINDOW,
  ATTACK_MOVE_MULT,
} from './constants'

export type PlayerState = 'idle' | 'rolling' | 'attacking'

export interface PlayerInput {
  move: Vec2
  moveMagnitude: number
  attack: boolean
  roll: boolean
  magic: boolean
}

export class Player {
  pos: Vec2 = { x: 0, y: 0 }
  facing: Vec2 = { x: 0, y: 1 }
  state: PlayerState = 'idle'

  /** Accumulated ground distance, used to drive the walk cycle. */
  distanceTravelled = 0
  /** True while actually walking, so the renderer can freeze the walk pose. */
  isMoving = false

  rollTimer = 0 // counts down through the roll itself
  rollCooldown = 0 // counts down from ROLL_COOLDOWN, measured from roll start
  rollTail = 0 // lingering extra speed after the roll ends
  private rollDir: Vec2 = { x: 0, y: 1 }

  comboStep = 0
  attackTimer = 0
  /** Total swings thrown. Drives strict left/right alternation, which
   *  comboStep cannot do because the combo is an odd 3 hits long. */
  swingCount = 0
  private comboWindow = 0

  // Day 3 wires the first real magic item in here. Until then the button is
  // hidden and this stays inert.
  hasMagicItem = false
  magicUses = 0

  /** Rolling out of a swing is allowed on purpose: it is the escape hatch. */
  get canRoll(): boolean {
    return this.state !== 'rolling' && this.rollCooldown <= 0
  }

  /** 0..1 across the roll, for the tumble animation. */
  get rollProgress(): number {
    if (this.state !== 'rolling') return 0
    return 1 - this.rollTimer / ROLL_DURATION
  }

  /** 0..1 across the current swing, for the punch animation. */
  get attackProgress(): number {
    if (this.state !== 'attacking') return 0
    const total = ATTACK_DURATIONS[this.comboStep] ?? ATTACK_DURATIONS[0]!
    return 1 - this.attackTimer / total
  }

  tick(input: PlayerInput): void {
    this.isMoving = input.moveMagnitude > 0 && this.state !== 'rolling'

    // Facing is locked during a roll so the tumble can't be steered visually.
    if (input.moveMagnitude > 0 && this.state !== 'rolling') {
      this.facing = normalize(input.move)
    }

    if (input.roll && this.canRoll) this.startRoll(input)
    if (input.attack && this.state === 'idle') this.startAttack()
    if (input.magic && this.hasMagicItem && this.state !== 'rolling') {
      this.magicUses++
      // Day 3: trigger the equipped magic item here.
    }

    if (this.state === 'rolling') this.tickRoll()
    else if (this.state === 'attacking') this.tickAttack(input)
    else this.tickWalk(input)

    this.rollCooldown = Math.max(0, this.rollCooldown - TICK)
    this.rollTail = Math.max(0, this.rollTail - TICK)
    this.comboWindow = Math.max(0, this.comboWindow - TICK)
  }

  private startAttack(): void {
    if (this.comboWindow <= 0) this.comboStep = 0
    this.swingCount++
    this.state = 'attacking'
    this.attackTimer = ATTACK_DURATIONS[this.comboStep] ?? ATTACK_DURATIONS[0]!
  }

  private tickAttack(input: PlayerInput): void {
    if (input.moveMagnitude > 0) {
      this.move(normalize(input.move), WALK_SPEED * input.moveMagnitude * ATTACK_MOVE_MULT)
    }
    this.attackTimer -= TICK
    if (this.attackTimer <= 0) {
      this.state = 'idle'
      this.attackTimer = 0
      this.comboStep = (this.comboStep + 1) % ATTACK_DURATIONS.length
      this.comboWindow = ATTACK_COMBO_WINDOW
    }
  }

  private startRoll(input: PlayerInput): void {
    this.state = 'rolling'
    this.attackTimer = 0 // a roll cancels whatever swing was in progress
    this.rollTimer = ROLL_DURATION
    this.rollCooldown = ROLL_COOLDOWN
    this.rollDir = input.moveMagnitude > 0 ? normalize(input.move) : this.facing
    this.facing = this.rollDir
  }

  private tickRoll(): void {
    // Ease from ROLL_SPEED_MULT down to 1 across the roll: a launch, not a slide.
    const mult = ROLL_SPEED_MULT + (1 - ROLL_SPEED_MULT) * this.rollProgress
    this.move(this.rollDir, WALK_SPEED * mult)

    this.rollTimer -= TICK
    if (this.rollTimer <= 0) {
      this.state = 'idle'
      this.rollTimer = 0
      this.rollTail = ROLL_TAIL_DURATION
    }
  }

  private tickWalk(input: PlayerInput): void {
    if (input.moveMagnitude <= 0) return
    const mult = this.rollTail > 0 ? ROLL_TAIL_MULT : 1
    this.move(normalize(input.move), WALK_SPEED * input.moveMagnitude * mult)
  }

  private move(dir: Vec2, speed: number): void {
    const step = scale(dir, speed * TICK)
    this.pos = { x: this.pos.x + step.x, y: this.pos.y + step.y }
    this.distanceTravelled += length(step)
  }
}
