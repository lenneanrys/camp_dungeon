/**
 * All the feel knobs live here on purpose. Sit on your phone with the dev
 * server running and change these numbers until the character feels right.
 */

export const TICK = 1 / 60

export const WALK_SPEED = 4.5 // world units per second

// Roll: a burst that eases DOWN from the peak to 1x (a launch, not a slide),
// then a short tail where you keep a bit of extra speed.
// Average multiplier is ~2.2, so the roll covers 4.5 * 2.2 * 0.42 = ~4.1 world
// units. The Combat Roll mod for Minecraft uses 3 blocks; 4 feels better with
// no enemies to dodge yet.
export const ROLL_DURATION = 0.42
export const ROLL_SPEED_MULT = 3.4
export const ROLL_TAIL_DURATION = 0.25
export const ROLL_TAIL_MULT = 1.35
/** Measured from the START of the roll, so this is 0.2s of idle after it ends. */
export const ROLL_COOLDOWN = ROLL_DURATION + 0.2

// Three-hit fist combo. The third swing is slower and heavier.
export const ATTACK_DURATIONS = [0.28, 0.26, 0.42]
export const ATTACK_COMBO_WINDOW = 0.5 // seconds after a swing to chain
export const ATTACK_MOVE_MULT = 0.35 // slowed mid-swing, never rooted
