import type { Vec2 } from '../sim/vec2'
import { normalize, length } from '../sim/vec2'

export const JOYSTICK_RADIUS = 48
export const JOYSTICK_DEADZONE = 8

/**
 * A floating stick: wherever the thumb lands becomes the centre. Players never
 * have to look down to find it, which is the single biggest feel win on touch.
 */
export class Joystick {
  active = false
  origin: Vec2 = { x: 0, y: 0 }
  knob: Vec2 = { x: 0, y: 0 }
  direction: Vec2 = { x: 0, y: 0 }
  magnitude = 0
  private touchId: number | null = null

  press(x: number, y: number, id: number): void {
    this.active = true
    this.touchId = id
    this.origin = { x, y }
    this.knob = { x, y }
    this.direction = { x: 0, y: 0 }
    this.magnitude = 0
  }

  move(x: number, y: number, id: number): void {
    if (!this.active || id !== this.touchId) return

    const delta = { x: x - this.origin.x, y: y - this.origin.y }
    const dist = length(delta)
    this.knob = { x, y }

    if (dist < JOYSTICK_DEADZONE) {
      this.direction = { x: 0, y: 0 }
      this.magnitude = 0
      return
    }

    this.direction = normalize(delta)

    if (dist > JOYSTICK_RADIUS) {
      // Let the origin trail the thumb so a long drag never feels stuck.
      this.origin = {
        x: x - this.direction.x * JOYSTICK_RADIUS,
        y: y - this.direction.y * JOYSTICK_RADIUS,
      }
      this.magnitude = 1
    } else {
      this.magnitude = dist / JOYSTICK_RADIUS
    }
  }

  release(id: number): void {
    if (id !== this.touchId) return
    this.active = false
    this.touchId = null
    this.direction = { x: 0, y: 0 }
    this.magnitude = 0
  }
}
