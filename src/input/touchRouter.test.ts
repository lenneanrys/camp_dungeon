import { describe, it, expect } from 'vitest'
import { TouchRouter } from './touchRouter'

const W = 800
const H = 400

describe('TouchRouter', () => {
  it('sends a left-half touch to the joystick', () => {
    const r = new TouchRouter(W, H)
    r.onDown(120, 300, 1)
    expect(r.joystick.active).toBe(true)
  })

  it('ignores a right-half touch that misses every button', () => {
    const r = new TouchRouter(W, H)
    r.onDown(600, 60, 1)
    expect(r.joystick.active).toBe(false)
  })

  it('sends a touch on the attack button to that button', () => {
    const r = new TouchRouter(W, H)
    const attack = r.button('attack')
    r.onDown(attack.x, attack.y, 1)
    expect(attack.justPressed).toBe(true)
    expect(r.joystick.active).toBe(false)
  })

  it('does not route to the hidden magic button', () => {
    const r = new TouchRouter(W, H)
    const magic = r.button('magic')
    expect(magic.visible).toBe(false)
    r.onDown(magic.x, magic.y, 1)
    expect(magic.justPressed).toBe(false)
  })

  it('shows the magic button once a magic item exists', () => {
    const r = new TouchRouter(W, H)
    r.setMagicAvailable(true)
    expect(r.button('magic').visible).toBe(true)
    r.onDown(r.button('magic').x, r.button('magic').y, 1)
    expect(r.button('magic').justPressed).toBe(true)
  })

  // Sliding a thumb off a button must not hand that touch to the joystick.
  it('a touch that starts on a button keeps it while sliding away', () => {
    const r = new TouchRouter(W, H)
    const attack = r.button('attack')
    r.onDown(attack.x, attack.y, 1)
    r.onMove(100, 300, 1)
    expect(r.joystick.active).toBe(false)
    expect(attack.held).toBe(true)
  })

  it('handles both thumbs at once', () => {
    const r = new TouchRouter(W, H)
    const attack = r.button('attack')
    r.onDown(120, 300, 1)
    r.onDown(attack.x, attack.y, 2)
    r.onMove(200, 300, 1)
    expect(r.joystick.magnitude).toBeGreaterThan(0)
    expect(attack.held).toBe(true)
  })

  it('releasing one thumb leaves the other alone', () => {
    const r = new TouchRouter(W, H)
    const attack = r.button('attack')
    r.onDown(120, 300, 1)
    r.onDown(attack.x, attack.y, 2)
    r.onUp(2)
    expect(attack.held).toBe(false)
    expect(r.joystick.active).toBe(true)
  })

  it('endTick clears justPressed on every button', () => {
    const r = new TouchRouter(W, H)
    r.onDown(r.button('attack').x, r.button('attack').y, 1)
    r.endTick()
    expect(r.button('attack').justPressed).toBe(false)
  })

  // The HUD needs these to place the joystick's resting home ring.
  it('remembers the screen size', () => {
    const r = new TouchRouter(W, H)
    expect(r.screenWidth).toBe(W)
    expect(r.screenHeight).toBe(H)
    r.resize(1000, 600)
    expect(r.screenWidth).toBe(1000)
    expect(r.screenHeight).toBe(600)
  })

  it('keeps buttons on screen after a resize', () => {
    const r = new TouchRouter(W, H)
    r.resize(1200, 500)
    for (const b of r.buttons) {
      expect(b.x).toBeGreaterThan(0)
      expect(b.x).toBeLessThan(1200)
      expect(b.y).toBeGreaterThan(0)
      expect(b.y).toBeLessThan(500)
    }
  })
})
