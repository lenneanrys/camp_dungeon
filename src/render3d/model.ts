import type { V3 } from './vec3'
import type { Rotation } from './rotation'
import { NO_ROTATION } from './rotation'

/**
 * Modelled on Minecraft's own ModelPart: a joint pivot, a rotation, and a list
 * of cuboids that ride along with it. Animation only ever sets rotations —
 * never positions — which is what keeps limbs attached to their joints.
 *
 * Model units follow Minecraft proportions: head 8x8x8, torso 8x12x4,
 * limbs 4x12x4. y is up, +z faces the camera, origin between the feet.
 */

export const PART_IDS = ['root', 'torso', 'head', 'armL', 'armR', 'legL', 'legR'] as const
export type HumanoidPart = (typeof PART_IDS)[number]

/**
 * Any named joint. The humanoid uses the fixed set above, but props built from
 * parts — a signpost whose arms point in different directions, say — name
 * their own.
 */
export type PartId = string

export interface PartCuboid {
  id: string
  pos: V3
  size: { w: number; h: number; d: number }
  color: string
  /** Painted on a surface: only a front face, so it cannot show from behind. */
  decal?: boolean
}

export interface ModelPart {
  id: PartId
  pivot: V3
  rotation: Rotation
  cuboids: PartCuboid[]
  /**
   * Parts inherit their parent's rotation, as in Minecraft's model tree.
   * Without this, curling the torso leaves the head hanging in mid-air — and
   * the tuck can never close into a ball, because the head stays as far from
   * the roll axis as it started.
   */
  parent?: PartId
}

export interface Costume {
  name: string
  colors: Record<string, string>
}

export const jungleExplorer: Costume = {
  name: 'Jungle Explorer',
  colors: {
    skin: '#c68642',
    hair: '#3b2a1a',
    shirt: '#d9cba3', // dirty linen
    vest: '#4e6b3f', // olive
    pants: '#8b7b4e', // khaki
    boots: '#5a3d24',
    hat: '#c2a878', // safari hat
    hatBand: '#6b5330',
    eye: '#241a12',
  },
}

export function buildParts(c: Costume): ModelPart[] {
  const col = (key: string): string => c.colors[key] ?? '#ff00ff'

  return [
    // The root carries whole-body motion: facing, and the roll's somersault.
    { id: 'root', pivot: { x: 0, y: 0, z: 0 }, rotation: { ...NO_ROTATION }, cuboids: [] },

    {
      id: 'torso',
      pivot: { x: 0, y: 12, z: 0 },
      rotation: { ...NO_ROTATION },
      cuboids: [
        { id: 'torso', pos: { x: 0, y: 18, z: 0 }, size: { w: 8, h: 12, d: 4 }, color: col('shirt') },
        // Slightly larger than the shirt, or the coplanar faces z-fight.
        { id: 'vest', pos: { x: 0, y: 18, z: 0 }, size: { w: 8.6, h: 10, d: 4.6 }, color: col('vest') },
      ],
    },

    {
      id: 'head',
      parent: 'torso',
      pivot: { x: 0, y: 24, z: 0 },
      rotation: { ...NO_ROTATION },
      cuboids: [
        { id: 'head', pos: { x: 0, y: 28, z: 0 }, size: { w: 8, h: 8, d: 8 }, color: col('skin') },
        // Hair tops out at 31.9 and the brim starts at 32.0. They used to
        // interpenetrate by 0.4, and overlapping solids have no correct
        // painter's-algorithm order — that seam would flicker.
        { id: 'hair', pos: { x: 0, y: 30.3, z: -0.4 }, size: { w: 8.3, h: 3.2, d: 8.3 }, color: col('hair') },
        { id: 'hatBrim', pos: { x: 0, y: 32.6, z: 0 }, size: { w: 13, h: 1.2, d: 13 }, color: col('hat') },
        { id: 'hatBand', pos: { x: 0, y: 33.7, z: 0 }, size: { w: 8.8, h: 1, d: 8.8 }, color: col('hatBand') },
        { id: 'hatCrown', pos: { x: 0, y: 35.5, z: 0 }, size: { w: 8.4, h: 2.6, d: 8.4 }, color: col('hat') },
        // Decals, not solids: only a front face exists, so turning away culls
        // them instead of painting eyes on the back of his head.
        { id: 'eyeL', pos: { x: -2, y: 28.6, z: 4.2 }, size: { w: 1.6, h: 1.6, d: 0.4 }, color: col('eye'), decal: true },
        { id: 'eyeR', pos: { x: 2, y: 28.6, z: 4.2 }, size: { w: 1.6, h: 1.6, d: 0.4 }, color: col('eye'), decal: true },
      ],
    },

    {
      id: 'armL',
      parent: 'torso',
      pivot: { x: -6, y: 24, z: 0 },
      rotation: { ...NO_ROTATION },
      cuboids: [
        { id: 'armL', pos: { x: -6, y: 18, z: 0 }, size: { w: 4, h: 12, d: 4 }, color: col('skin') },
      ],
    },
    {
      id: 'armR',
      parent: 'torso',
      pivot: { x: 6, y: 24, z: 0 },
      rotation: { ...NO_ROTATION },
      cuboids: [
        { id: 'armR', pos: { x: 6, y: 18, z: 0 }, size: { w: 4, h: 12, d: 4 }, color: col('skin') },
      ],
    },

    // Boots live inside the leg part, so they turn with the leg. As separate
    // top-level boxes they slid up the shin during the walk.
    {
      id: 'legL',
      pivot: { x: -2, y: 12, z: 0 },
      rotation: { ...NO_ROTATION },
      cuboids: [
        { id: 'legL', pos: { x: -2, y: 6, z: 0 }, size: { w: 4, h: 12, d: 4 }, color: col('pants') },
        { id: 'bootL', pos: { x: -2, y: 1.5, z: 0.3 }, size: { w: 4.4, h: 3, d: 4.6 }, color: col('boots') },
      ],
    },
    {
      id: 'legR',
      pivot: { x: 2, y: 12, z: 0 },
      rotation: { ...NO_ROTATION },
      cuboids: [
        { id: 'legR', pos: { x: 2, y: 6, z: 0 }, size: { w: 4, h: 12, d: 4 }, color: col('pants') },
        { id: 'bootR', pos: { x: 2, y: 1.5, z: 0.3 }, size: { w: 4.4, h: 3, d: 4.6 }, color: col('boots') },
      ],
    },
  ]
}
