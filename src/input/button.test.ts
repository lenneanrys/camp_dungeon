import { describe, it, expect } from 'vitest'
import { TouchButton } from './button'

describe('TouchButton', () => {
  it('hit-tests within its radius', () => {
    const b = new TouchButton('attack', 100, 100, 40)
    expect(b.contains(120, 100)).toBe(true)
    expect(b.contains(180, 100)).toBe(false)
  })

  // This is how the magic button exists without being usable yet.
  it('a hidden button cannot be hit', () => {
    const b = new TouchButton('magic', 100, 100, 40)
    b.visible = false
    expect(b.contains(100, 100)).toBe(false)
  })

  it('a hidden button ignores a direct press', () => {
    const b = new TouchButton('magic', 100, 100, 40)
    b.visible = false
    b.press(1)
    expect(b.held).toBe(false)
    expect(b.justPressed).toBe(false)
  })

  // Without this, holding the button would fire an attack every single tick.
  it('justPressed lasts exactly one tick', () => {
    const b = new TouchButton('attack', 100, 100, 40)
    b.press(1)
    expect(b.justPressed).toBe(true)
    expect(b.held).toBe(true)
    b.endTick()
    expect(b.justPressed).toBe(false)
    expect(b.held).toBe(true)
  })

  it('release clears held', () => {
    const b = new TouchButton('attack', 100, 100, 40)
    b.press(1)
    b.release(1)
    expect(b.held).toBe(false)
  })

  it('ignores release from a different touch id', () => {
    const b = new TouchButton('attack', 100, 100, 40)
    b.press(1)
    b.release(9)
    expect(b.held).toBe(true)
  })
})
