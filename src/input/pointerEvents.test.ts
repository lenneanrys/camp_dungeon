import { describe, it, expect } from 'vitest'
import { RELEASE_EVENTS, DOWN_EVENT, MOVE_EVENT } from './pointerEvents'

describe('pointer event binding', () => {
  it('releases on pointerup and pointercancel', () => {
    expect(RELEASE_EVENTS).toContain('pointerup')
    expect(RELEASE_EVENTS).toContain('pointercancel')
  })

  // Regression guard. iOS fires pointerout/pointerleave spuriously while a
  // thumb is still down; treating them as a release kills the joystick
  // mid-drag, which is exactly what happened on the first phone test.
  it('never releases on pointerout or pointerleave', () => {
    expect(RELEASE_EVENTS).not.toContain('pointerout')
    expect(RELEASE_EVENTS).not.toContain('pointerleave')
  })

  it('uses pointerdown and pointermove', () => {
    expect(DOWN_EVENT).toBe('pointerdown')
    expect(MOVE_EVENT).toBe('pointermove')
  })
})
