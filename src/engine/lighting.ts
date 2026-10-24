// Light: a physical sky (also the scene's environment for reflections and fill), the sun with soft
// shadows that enter only through the openings, the soft light of each window, and the lamps at
// night. Changing the time of day updates intensities and colours only: the number of lights never
// changes, so no shader is recompiled.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { axis, BOUNDS, WALLS } from '../domain/apartment';
import { LIGHTINGS, type LightId } from '../domain/catalog';
import { LAMPS } from './furniture';
import { tex, type Materials } from './materials';

export type Quality = 'high' | 'low';
const CENTRE = new THREE.Vector3((BOUNDS.x0 + BOUNDS.x1) / 2, 0, (BOUNDS.z0 + BOUNDS.z1) / 2);

/** Sun direction from compass azimuth (clockwise from north, which is −z) and elevation. */
export function sunDirection(azimuth: number, elevation: number): THREE.Vector3 {
  const az = THREE.MathUtils.degToRad(azimuth);
  const el = THREE.MathUtils.degToRad(elevation);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

export class Lighting {
  readonly sky = new Sky();
  readonly sun = new THREE.DirectionalLight('#ffffff', 3);
  readonly fill = new THREE.HemisphereLight('#eef1f4', '#ddd2c4', 0.9);
  readonly windows: THREE.RectAreaLight[] = [];
  readonly lamps: THREE.PointLight[] = [];
  private readonly pmrem: THREE.PMREMGenerator;
  private env: THREE.WebGLRenderTarget | null = null;
  private readonly skyScene = new THREE.Scene();

  constructor(private readonly scene: THREE.Scene, private readonly renderer: THREE.WebGLRenderer, private readonly quality: Quality) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.sky.scale.setScalar(300);
    const u = this.skyUniforms();
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.85;
    scene.add(this.sky);

    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
    s.camera.left = -8; s.camera.right = 8; s.camera.top = 8; s.camera.bottom = -8; s.camera.near = 1; s.camera.far = 60;
    s.bias = -0.0003;
    s.normalBias = 0.02;
    s.radius = 3;
    this.sun.target.position.copy(CENTRE);
    scene.add(this.sun, this.sun.target, this.fill);

    if (quality === 'high') {
      // the windows glow softly into the rooms (area lights face inwards, one per opening)
      RectAreaLightUniformsLib.init();
      for (const w of WALLS.filter((x) => x.exterior)) {
        const { at, dir } = axis(w);
        for (const o of w.openings.filter((x) => x.kind === 'window' || x.kind === 'bay')) {
          const [x, z] = at(o.at + o.width / 2);
          const light = new THREE.RectAreaLight('#ffffff', 0, o.width, o.height);
          // inward normal: perpendicular to the wall, towards the apartment's centre
          const normal = new THREE.Vector3(-dir[1], 0, dir[0]);
          if (normal.dot(new THREE.Vector3(CENTRE.x - x, 0, CENTRE.z - z)) < 0) normal.negate();
          light.position.set(x + normal.x * 0.02, o.sill + o.height / 2, z + normal.z * 0.02);
          light.lookAt(light.position.clone().add(normal));
          this.windows.push(light);
          scene.add(light);
        }
      }
    }
    for (const lamp of quality === 'high' ? LAMPS : LAMPS.slice(0, 4)) {
      const light = new THREE.PointLight('#ffd3a3', 0, lamp.reach, 2);
      light.position.set(...lamp.at);
      light.userData.power = lamp.power;
      this.lamps.push(light);
      scene.add(light);
    }
  }

  private skyUniforms() {
    return this.sky.material.uniforms as Record<'rayleigh' | 'mieCoefficient' | 'mieDirectionalG' | 'turbidity' | 'sunPosition', THREE.IUniform>;
  }

  apply(id: LightId, m: Materials): void {
    const l = LIGHTINGS[id];
    const dir = sunDirection(l.azimuth, l.elevation);
    const u = this.skyUniforms();
    u.turbidity.value = l.turbidity;
    (u.sunPosition.value as THREE.Vector3).copy(dir);
    this.sun.position.copy(CENTRE).addScaledVector(dir, 30);
    this.sun.color.set(l.sun);
    this.sun.intensity = l.intensity;
    this.sun.visible = l.elevation > 0;
    const night = id === 'nuit';
    const dusk = id === 'coucher';
    // the sky's light, and the warm light bounced by the floors and walls
    // without the window area lights (phones), the sky's fill makes up for them
    const boost = this.windows.length ? 1 : 1.8;
    this.fill.intensity = (night ? 0.05 : dusk ? 0.55 : 0.9) * boost;
    this.fill.color.set(night ? '#7d8bb0' : dusk ? '#f6d2b4' : '#eef1f4');
    for (const w of this.windows) {
      w.intensity = night ? 0.12 : dusk ? 2.4 : id === 'matin' ? 3.6 : 4.4;
      w.color.set(night ? '#5b6b9a' : dusk ? '#ffcfa8' : '#fff8ef');
    }
    m.curtain.emissiveIntensity = night ? 0 : dusk ? 0.12 : 0.22;
    for (const lamp of this.lamps) lamp.intensity = l.lamps ? (night ? 15 : 6) * (lamp.userData.power as number) : 0;
    m.lampShade.emissiveIntensity = l.lamps ? (night ? 0.7 : 0.35) : 0;
    m.bulb.emissiveIntensity = l.lamps ? 3 : 0;
    this.renderer.toneMappingExposure = l.exposure;
    // outside, seen through the windows: bright, as in a property photograph exposed for the interior
    const outside = night ? 0.015 : dusk ? 0.2 : 0.42;
    for (const mat of [m.ground, m.tree, m.tree2, m.trunk]) mat.emissive.copy(mat.color).multiplyScalar(outside);
    // the buildings across: lit by day, a few windows glowing at night
    if (!m.facade.emissiveMap) m.facade.needsUpdate = true;
    m.facade.emissiveMap = night ? tex('facade-nuit', 1 / 6, true) : m.facade.map;
    if (night) m.facade.emissive.set('#ffffff').multiplyScalar(0.9);
    else m.facade.emissive.copy(m.facade.color).multiplyScalar(outside);

    // the environment (reflections and fill light) is the sky itself, re-rendered for this time of day
    this.skyScene.add(this.sky);
    this.env?.dispose();
    this.env = this.pmrem.fromScene(this.skyScene, 0, 0.1, 1000);
    this.scene.add(this.sky);
    this.scene.environment = this.env.texture;
    this.scene.environmentIntensity = (night ? 0.05 : dusk ? 0.25 : 0.35) * boost;
    this.renderer.shadowMap.needsUpdate = true;
  }

  dispose(): void {
    this.env?.dispose();
    this.pmrem.dispose();
  }
}
