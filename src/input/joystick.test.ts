import { describe, it, expect } from 'vitest'
import { Joystick, JOYSTICK_RADIUS, JOYSTICK_DEADZONE } from './joystick'

describe('Joystick', () => {
  it('is neutral before any touch', () => {
    const j = new Joystick()
    expect(j.magnitude).toBe(0)
    expect(j.direction).toEqual({ x: 0, y: 0 })
    expect(j.active).toBe(false)
  })

  it('becomes active on press and reports the origin', () => {
    const j = new Joystick()
    j.press(100, 200, 1)
    expect(j.active).toBe(true)
    expect(j.origin).toEqual({ x: 100, y: 200 })
    expect(j.magnitude).toBe(0)
  })

  it('ignores drags inside the deadzone', () => {
    const j = new Joystick()
    j.press(100, 200, 1)
    j.move(100 + JOYSTICK_DEADZONE - 1, 200, 1)
    expect(j.magnitude).toBe(0)
  })

  it('reports direction and partial magnitude', () => {
    const j = new Joystick()
    j.press(100, 200, 1)
    j.move(100 + JOYSTICK_RADIUS / 2, 200, 1)
    expect(j.direction.x).toBeCloseTo(1)
    expect(j.direction.y).toBeCloseTo(0)
    expect(j.magnitude).toBeGreaterThan(0.4)
    expect(j.magnitude).toBeLessThan(0.6)
  })

  it('caps magnitude at 1 and drags the origin along', () => {
    const j = new Joystick()
    j.press(100, 200, 1)
    j.move(100 + JOYSTICK_RADIUS * 3, 200, 1)
    expect(j.magnitude).toBe(1)
    expect(j.origin.x).toBeCloseTo(100 + JOYSTICK_RADIUS * 2)
  })

  // This is what stops the stick lurching sideways when the right thumb taps
  // attack. Multi-touch bleed is the top reason mobile games feel wrong.
  it('ignores events from a different touch id', () => {
    const j = new Joystick()
    j.press(100, 200, 1)
    j.move(300, 200, 7)
    expect(j.magnitude).toBe(0)
  })

  it('resets on release', () => {
    const j = new Joystick()
    j.press(100, 200, 1)
    j.move(180, 200, 1)
    j.release(1)
    expect(j.active).toBe(false)
    expect(j.magnitude).toBe(0)
  })

  it('ignores release from a different touch id', () => {
    const j = new Joystick()
    j.press(100, 200, 1)
    j.move(180, 200, 1)
    j.release(7)
    expect(j.active).toBe(true)
  })
})
