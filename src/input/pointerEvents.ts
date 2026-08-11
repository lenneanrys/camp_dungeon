/**
 * Which DOM pointer events drive the controls.
 *
 * pointerout and pointerleave are deliberately absent: iOS fires them
 * spuriously while a thumb is still down, and treating them as a release
 * makes the joystick die mid-drag.
 */
export const DOWN_EVENT = 'pointerdown' as const
export const MOVE_EVENT = 'pointermove' as const
export const RELEASE_EVENTS = ['pointerup', 'pointercancel'] as const
