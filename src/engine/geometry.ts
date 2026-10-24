// Geometry helpers. Boxes carry texture coordinates in metres measured in the world, so a parquet or
// a plaster never stretches with the size of what it covers. Pieces that share a material are merged
// into one mesh (one draw call) by a Batch: the apartment is several hundred parts, drawn in a few dozen calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** An axis-aligned box from its two corners, with world-space UVs on every face. */
export function boxUV(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  const face = (corners: [number, number, number][], normal: [number, number, number], uv: (p: [number, number, number]) => [number, number]) => {
    const start = positions.length / 3;
    for (const c of corners) { positions.push(...c); normals.push(...normal); uvs.push(...uv(c)); }
    index.push(start, start + 1, start + 2, start, start + 2, start + 3);
  };
  face([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], ([, y, z]) => [-z, y]);
  face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], ([, y, z]) => [z, y]);
  face([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], ([x, , z]) => [x, -z]);
  face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], ([x, , z]) => [x, z]);
  face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], ([x, y]) => [x, y]);
  face([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], ([x, y]) => [-x, y]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  return g;
}

/** A horizontal rectangle facing up (floors) or down (ceilings), UVs in metres. */
export function slab(x0: number, z0: number, x1: number, z1: number, y: number, down = false): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const p = down ? [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1] : [x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: 4 }, () => [0, down ? -1 : 1, 0]).flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(down ? [x0, z0, x1, z0, x1, z1, x0, z1] : [x0, -z1, x1, -z1, x1, -z0, x0, -z0], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

/** Moves and turns a geometry into place (rotation about the vertical axis, then translation). */
export function place(g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
  return g.applyMatrix4(m);
}

/** Collects geometries per material, then merges each material's pieces into one mesh. */
export class Batch {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  constructor(private readonly options: { cast?: boolean; receive?: boolean } = {}) {}

  add(g: THREE.BufferGeometry, material: THREE.Material): this {
    const geometry = g.index ? g : g.setIndex([...Array(g.getAttribute('position').count).keys()]);
    // every piece needs the same attributes to merge
    if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
    const list = this.parts.get(material) ?? [];
    list.push(geometry);
    this.parts.set(material, list);
    return this;
  }

  /** Appends a group's meshes (with their world transforms), e.g. a furniture piece built with Groups. */
  addObject(o: THREE.Object3D): this {
    o.updateMatrixWorld(true);
    o.traverse((child) => {
      if (child instanceof THREE.Mesh && !Array.isArray(child.material)) this.add((child.geometry as THREE.BufferGeometry).clone().applyMatrix4(child.matrixWorld), child.material as THREE.Material);
    });
    return this;
  }

  build(name: string): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    for (const [material, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material);
      // glass and sheer fabric would block the sun like a wall: they cast no shadow
      mesh.castShadow = (this.options.cast ?? true) && !material.transparent;
      mesh.receiveShadow = this.options.receive ?? true;
      group.add(mesh);
      for (const g of list) g.dispose();
    }
    this.parts.clear();
    return group;
  }
}
