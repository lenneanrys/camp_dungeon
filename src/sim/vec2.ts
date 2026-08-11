export interface Vec2 {
  x: number
  y: number
}

export const length = (v: Vec2): number => Math.hypot(v.x, v.y)

export const scale = (v: Vec2, k: number): Vec2 => ({ x: v.x * k, y: v.y * k })

export function normalize(v: Vec2): Vec2 {
  const len = length(v)
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len }
}

export function clampLength(v: Vec2, max: number): Vec2 {
  const len = length(v)
  return len <= max ? v : scale(v, max / len)
}
