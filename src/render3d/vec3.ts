export interface V3 {
  x: number
  y: number
  z: number
}

export const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })

export const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })

export const scale = (v: V3, k: number): V3 => ({ x: v.x * k, y: v.y * k, z: v.z * k })

export const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z

/** Right-handed. This decides which way face normals point, and so what is culled. */
export const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

export const length = (v: V3): number => Math.hypot(v.x, v.y, v.z)

export function normalize(v: V3): V3 {
  const len = length(v)
  return len === 0 ? { x: 0, y: 0, z: 0 } : scale(v, 1 / len)
}
