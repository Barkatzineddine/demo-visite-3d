// Every material of the tour, created once and updated in place when the visitor changes a finish,
// so a change costs no shader compilation. Texture coordinates are in metres (see geometry.ts):
// `repeat` is how many texture tiles fit in one metre.
import * as THREE from 'three';
import { FLOORS, FRONT_COLORS, WALL_COLORS, type FloorId, type FrontId, type TopId, type WallId } from '../domain/catalog';

const base = `${import.meta.env.BASE_URL}textures/`;
const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

export function tex(name: string, repeat: number, color = false): THREE.Texture {
  const key = `${name}@${repeat}`;
  const known = cache.get(key);
  if (known) return known;
  const t = loader.load(`${base}${name}.webp`, () => { onTextureLoad(); });
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

let onTextureLoad: () => void = () => undefined;
/** Called whenever a texture arrives, so the scene redraws with it. */
export const whenTexturesLoad = (fn: () => void) => { onTextureLoad = fn; };

/** A PBR set: colour, normal and roughness maps of one generated texture (flat ones have colour only). */
function pbr(name: string, size: number, extra: THREE.MeshStandardMaterialParameters = {}, flat = false): THREE.MeshStandardMaterial {
  const r = 1 / size;
  return new THREE.MeshStandardMaterial({
    map: tex(name, r, true), ...(flat ? {} : { normalMap: tex(`${name}-n`, r), roughnessMap: tex(`${name}-r`, r), roughness: 1 }), ...extra,
  });
}

export function createMaterials() {
  const m = {
    floorMain: pbr('parquet', 0.84),
    floorTiles: pbr('terrazzo', 1),
    wall: pbr('platre', 2, { color: WALL_COLORS.blanc }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 0.95 }),
    wallCap: new THREE.MeshStandardMaterial({ color: '#3b3a37', roughness: 0.9 }),
    render: new THREE.MeshStandardMaterial({ color: '#e7e2d9', roughness: 0.95 }),
    zellige: pbr('zellige', 0.6),
    skirting: new THREE.MeshStandardMaterial({ color: '#f2f0ec', roughness: 0.6 }),
    frame: new THREE.MeshStandardMaterial({ color: '#4a4d50', roughness: 0.45, metalness: 0.6 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#dfe9ef', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.4, depthWrite: false }),
    door: new THREE.MeshStandardMaterial({ color: '#f3f1ec', roughness: 0.5 }),
    entryDoor: pbr('chene', 1, { color: '#6b5440' }),
    handle: new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.35, metalness: 0.8 }),
    oak: pbr('chene', 1),
    walnut: pbr('chene', 1, { color: '#6d4f3a' }),
    fronts: new THREE.MeshStandardMaterial({ color: FRONT_COLORS.blanc, roughness: 0.55 }),
    top: pbr('quartz', 1, { roughness: 0.18 }, true),
    steel: new THREE.MeshStandardMaterial({ color: '#c9ccd0', roughness: 0.28, metalness: 1 }),
    black: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.2, metalness: 0.2 }),
    blackMatte: new THREE.MeshStandardMaterial({ color: '#202020', roughness: 0.7 }),
    brass: new THREE.MeshStandardMaterial({ color: '#b48a4a', roughness: 0.3, metalness: 1 }),
    ceramic: new THREE.MeshStandardMaterial({ color: '#f7f6f2', roughness: 0.12 }),
    mirror: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.02, metalness: 1 }),
    sofa: pbr('tissu', 0.25, { color: '#9aa2a0' }),
    armchair: pbr('tissu', 0.25, { color: '#c5774f' }),
    cushion: pbr('tissu', 0.25, { color: '#e8dfcf' }),
    cushion2: pbr('tissu', 0.25, { color: '#556b5b' }),
    linen: pbr('tissu', 0.25, { color: '#f2eee6' }),
    duvet: pbr('tissu', 0.25, { color: '#d9d2c4' }),
    throw: pbr('tissu', 0.25, { color: '#b9845f' }),
    // sheer linen: daylight shines through it (emissive, set with the time of day)
    curtain: pbr('tissu', 0.25, { color: '#f4efe6', transparent: true, opacity: 0.9, side: THREE.DoubleSide, emissive: '#fff4e4', emissiveIntensity: 0 }),
    rug: pbr('tapis', 2),
    deck: pbr('terrasse', 1),
    leaf: new THREE.MeshStandardMaterial({ map: tex('feuille', 1, true), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 }),
    pot: new THREE.MeshStandardMaterial({ color: '#c9b9a6', roughness: 0.85 }),
    potDark: new THREE.MeshStandardMaterial({ color: '#3e3a36', roughness: 0.8 }),
    art1: new THREE.MeshStandardMaterial({ map: tex('tableau1', 1, true), roughness: 0.9 }),
    art2: new THREE.MeshStandardMaterial({ map: tex('tableau2', 1, true), roughness: 0.9 }),
    lampShade: new THREE.MeshStandardMaterial({ color: '#f3ead8', roughness: 0.8, side: THREE.DoubleSide, emissive: '#ffdcae', emissiveIntensity: 0 }),
    bulb: new THREE.MeshStandardMaterial({ color: '#fff6e6', emissive: '#ffd9a0', emissiveIntensity: 0 }),
    screen: new THREE.MeshStandardMaterial({ color: '#0c0d0f', roughness: 0.08, metalness: 0.4 }),
    book: [
      new THREE.MeshStandardMaterial({ color: '#8c3b2e', roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: '#2f4858', roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: '#d9c9a3', roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: '#5b6b4f', roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: '#e8e2d6', roughness: 0.8 }),
    ],
    facade: pbr('facade', 6, { color: '#e3dccf' }),
    ground: new THREE.MeshStandardMaterial({ color: '#7a7d72', roughness: 1 }),
    tree: new THREE.MeshStandardMaterial({ color: '#5d7a43', roughness: 0.9 }),
    tree2: new THREE.MeshStandardMaterial({ color: '#7a8f4e', roughness: 0.9 }),
    trunk: new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 0.9 }),
    railing: new THREE.MeshPhysicalMaterial({ color: '#cfdde3', roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false }),
    white: new THREE.MeshStandardMaterial({ color: '#f5f4f0', roughness: 0.5 }),
  };
  return m;
}
export type Materials = ReturnType<typeof createMaterials>;

const FLOOR_SIZE: Record<FloorId, number> = { chene: 0.84, carrelage: 1.2, beton: 2.5 };

export function applyFinishes(m: Materials, c: { floor: FloorId; walls: WallId; fronts: FrontId; top: TopId }): void {
  const f = FLOORS[c.floor];
  const r = 1 / FLOOR_SIZE[c.floor];
  m.floorMain.map = tex(f.texture, r, true);
  m.floorMain.normalMap = tex(`${f.texture}-n`, r);
  m.floorMain.roughnessMap = tex(`${f.texture}-r`, r);
  m.floorMain.needsUpdate = true;
  m.wall.color.set(WALL_COLORS[c.walls]);
  // kitchen fronts: oak takes the wood maps, the others are lacquers
  if (c.fronts === 'chene') { m.fronts.map = tex('chene', 1, true); m.fronts.roughness = 0.6; m.fronts.color.set('#ffffff'); }
  else { m.fronts.map = null; m.fronts.roughness = 0.5; m.fronts.color.set(FRONT_COLORS[c.fronts]); }
  m.fronts.needsUpdate = true;
  const top = c.top === 'quartz' ? 'quartz' : c.top === 'chene' ? 'chene' : 'beton';
  m.top.map = tex(top, top === 'beton' ? 0.4 : 1, true);
  m.top.roughnessMap = c.top === 'quartz' ? null : tex(`${top}-r`, top === 'beton' ? 0.4 : 1);
  m.top.roughness = c.top === 'quartz' ? 0.18 : 1;
  m.top.needsUpdate = true;
}
