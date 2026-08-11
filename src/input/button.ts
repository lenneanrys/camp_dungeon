export type ButtonId = 'attack' | 'roll' | 'magic'

export class TouchButton {
  visible = true
  held = false
  justPressed = false
  private touchId: number | null = null

  constructor(
    readonly id: ButtonId,
    public x: number,
    public y: number,
    public radius: number,
  ) {}

  contains(px: number, py: number): boolean {
    if (!this.visible) return false
    return Math.hypot(px - this.x, py - this.y) <= this.radius
  }

  press(id: number): void {
    if (!this.visible) return
    this.touchId = id
    this.held = true
    this.justPressed = true
  }

  release(id: number): void {
    if (id !== this.touchId) return
    this.touchId = null
    this.held = false
  }

  /** Call once at the end of every sim tick so a hold fires only once. */
  endTick(): void {
    this.justPressed = false
  }
}
