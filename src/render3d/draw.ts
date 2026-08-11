import type { DrawFace } from './scene'
import { SCALE, PITCH } from './camera'

/** Multiply a #rrggbb colour by a Lambert term. */
export function litColor(hex: string, lit: number): string {
  const n = parseInt(hex.slice(1), 16)
  const clamp = (c: number): number => Math.max(0, Math.min(255, Math.round(c * lit)))
  return `rgb(${clamp((n >> 16) & 255)},${clamp((n >> 8) & 255)},${clamp(n & 255)})`
}

export function drawFaces(
  ctx: CanvasRenderingContext2D,
  faces: DrawFace[],
  screenX: number,
  screenY: number,
): void {
  ctx.save()
  ctx.translate(screenX, screenY)

  for (const face of faces) {
    const color = litColor(face.color, face.lit)
    ctx.beginPath()
    ctx.moveTo(face.points[0]!.sx, face.points[0]!.sy)
    for (let i = 1; i < face.points.length; i++) {
      ctx.lineTo(face.points[i]!.sx, face.points[i]!.sy)
    }
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    // Stroking the same colour closes the hairline seams that appear between
    // adjacent quads when the canvas antialiases their shared edge.
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.stroke()
  }

  ctx.restore()
}

/** Flat contact shadow, foreshortened by the same camera. */
export function drawShadow(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  radius: number,
  alpha: number,
): void {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`
  ctx.beginPath()
  ctx.ellipse(
    screenX,
    screenY,
    radius * SCALE,
    radius * SCALE * Math.sin(PITCH),
    0,
    0,
    Math.PI * 2,
  )
  ctx.fill()
}
