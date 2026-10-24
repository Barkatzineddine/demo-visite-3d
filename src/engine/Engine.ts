// The tour engine, plain three.js and independent of React: it builds the scene, applies the
// visitor's choices, and moves the camera between the dollhouse and the rooms. Frames are drawn only
// when something changes (a drag, a flight, a step, a new texture), and the sun's shadows are computed
// once per time of day, since nothing in the apartment moves.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BALCONY, BOUNDS, EYE, roomAt, ROOMS, walk, type RoomId } from '../domain/apartment';
import { HOTSPOTS } from '../domain/catalog';
import type { Choices, View } from '../domain/schema';
import { buildFurniture } from './furniture';
import { Lighting, type Quality } from './lighting';
import { applyFinishes, createMaterials, whenTexturesLoad, type Materials } from './materials';
import { buildBalcony, buildBase, buildCeilings, buildDoors, buildFloors, buildRadiators, buildSkirting, buildSurroundings, buildTiling, buildWalls, CUT } from './structure';

export interface HotspotOnScreen { id: string; x: number; y: number }
export interface EngineEvents {
  /** The first frame is on screen. */
  ready: () => void;
  /** The camera arrived somewhere: the dollhouse or a room. */
  view: (view: View) => void;
  /** Hotspots in view, in CSS pixels from the canvas's top-left corner. */
  hotspots: (list: HotspotOnScreen[]) => void;
  /** Where the visitor stands and looks (walk mode), null over the dollhouse: for the mini plan. */
  pose: (pose: Pose | null) => void;
  /** The GPU dropped the WebGL context (driver reset, too many tabs). */
  lost: () => void;
}
export interface Pose { x: number; z: number; yaw: number }

/** The dollhouse's backdrop, following the time of day. */
const BACKDROP: Record<Choices['light'], string> = { matin: '#ebe7e0', 'apres-midi': '#e9e5de', coucher: '#ddd3ca', nuit: '#1f232b' };
const DOLLHOUSE_TARGET = new THREE.Vector3((BOUNDS.x0 + BOUNDS.x1) / 2, 0.3, (BOUNDS.z0 + BALCONY.z1) / 2);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
  private readonly materials: Materials;
  private readonly lighting: Lighting;
  private readonly composer: EffectComposer | null;
  private readonly orbit: OrbitControls;
  private readonly floors: THREE.Mesh[];
  private readonly groups: Record<'walls' | 'wallsCut' | 'doors' | 'doorsCut' | 'tiling' | 'tilingCut' | 'ceilings' | 'furniture' | 'surroundings', THREE.Group>;
  private readonly decor: THREE.Object3D;
  private readonly observer: ResizeObserver;
  private readonly raycaster = new THREE.Raycaster();
  private mode: 'dollhouse' | 'walk' = 'dollhouse';
  private view: View = 'maquette';
  /** Where the camera is going: the view it is flying to, or the current one. */
  private target: View = 'maquette';
  private lastPose = '';
  private yaw = 0;
  private pitch = 0;
  private flight: { from: THREE.Vector3; to: THREE.Vector3; fromLook: THREE.Vector3; toLook: THREE.Vector3; start: number; duration: number; done: () => void } | null = null;
  private stroll: { to: [number, number] } | null = null;
  private keys = new Set<string>();
  private frame = 0;
  private lastTime = 0;
  private drag: { x: number; y: number; moved: boolean; yaw: number; pitch: number } | null = null;
  private readied = false;
  private lastHotspots = '';
  private choices: Choices;

  constructor(private readonly host: HTMLElement, choices: Choices, private readonly quality: Quality, private readonly events: EngineEvents) {
    this.choices = choices;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality === 'low' || devicePixelRatio < 1.5, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.75 : 1.25));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.className = 'tour-canvas';
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.events.lost(); });
    host.append(canvas);

    const m = createMaterials();
    this.materials = m;
    whenTexturesLoad(() => { this.request(); });
    this.floors = buildFloors(m);
    this.groups = {
      walls: buildWalls(m, 2.5),
      wallsCut: buildWalls(m, CUT),
      doors: buildDoors(m, 2.5),
      doorsCut: buildDoors(m, CUT),
      tiling: buildTiling(m, 2.5),
      tilingCut: buildTiling(m, CUT),
      ceilings: buildCeilings(m),
      furniture: buildFurniture(m),
      surroundings: buildSurroundings(m),
    };
    this.decor = this.groups.furniture.getObjectByName('wall-decor') ?? new THREE.Group();
    this.scene.add(...this.floors, ...Object.values(this.groups), buildSkirting(m), buildRadiators(m), buildBalcony(m), buildBase(m));
    this.lighting = new Lighting(this.scene, this.renderer, quality);
    if (quality === 'high') {
      // the bathroom mirror reflects the room (drawn only when it is in view)
      const mirror = new Reflector(new THREE.PlaneGeometry(0.9, 0.8), { textureWidth: 512, textureHeight: 512, color: 0xdfe3e6, clipBias: 0.003 });
      mirror.position.set(0.85, 1.45, 2.536);
      mirror.rotation.y = Math.PI;
      this.groups.furniture.add(mirror);
    }

    if (quality === 'high') {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      const ao = new GTAOPass(this.scene, this.camera, 1, 1);
      ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 16 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
      this.composer.addPass(ao);
      this.composer.addPass(new OutputPass());
    } else this.composer = null;

    this.orbit = new OrbitControls(this.camera, canvas);
    Object.assign(this.orbit, { enableDamping: true, dampingFactor: 0.09, enablePan: false, minDistance: 7, maxDistance: 32, minPolarAngle: 0.25, maxPolarAngle: 1.15 });
    this.orbit.target.copy(DOLLHOUSE_TARGET);
    this.orbit.addEventListener('change', () => { this.request(); });
    this.applyMode('dollhouse');
    this.observer = new ResizeObserver(() => { this.resize(); });
    this.observer.observe(host);
    this.resize();
    this.placeDollhouse();
    this.bindInput(canvas);
    this.setChoices(choices, true);
  }

  // ---------- choices ----------
  setChoices(c: Choices, first = false): void {
    const before = this.choices;
    this.choices = c;
    applyFinishes(this.materials, c);
    this.groups.furniture.visible = c.furnished;
    if (first || before.light !== c.light) {
      this.lighting.apply(c.light, this.materials);
      if (this.mode === 'dollhouse') this.scene.background = new THREE.Color(BACKDROP[c.light]);
    }
    if (first || before.furnished !== c.furnished) this.renderer.shadowMap.needsUpdate = true;
    if (!first && c.view !== this.target) this.goTo(c.view);
    else if (first && c.view !== 'maquette') this.enterRoom(c.view, true);
    this.request();
  }

  // ---------- camera ----------
  /** The dollhouse viewpoint, further back on narrow screens so the whole apartment fits. */
  private dollhousePosition(): THREE.Vector3 {
    const k = THREE.MathUtils.clamp(1.25 / Math.max(this.camera.aspect, 0.4), 1, 1.75);
    return DOLLHOUSE_TARGET.clone().add(new THREE.Vector3(-4, 12.7, 11).multiplyScalar(k));
  }

  private placeDollhouse(): void {
    this.camera.position.copy(this.dollhousePosition());
    this.camera.lookAt(DOLLHOUSE_TARGET);
    this.orbit.update();
  }

  private applyMode(mode: 'dollhouse' | 'walk'): void {
    this.mode = mode;
    this.orbit.enabled = mode === 'dollhouse';
    this.groups.walls.visible = mode === 'walk';
    this.groups.wallsCut.visible = mode === 'dollhouse';
    this.groups.doors.visible = mode === 'walk';
    this.groups.doorsCut.visible = mode === 'dollhouse';
    this.groups.tiling.visible = mode === 'walk';
    this.groups.tilingCut.visible = mode === 'dollhouse';
    this.decor.visible = mode === 'walk';
    this.groups.ceilings.visible = mode === 'walk';
    this.groups.surroundings.visible = mode === 'walk';
    this.scene.background = mode === 'dollhouse' ? new THREE.Color(BACKDROP[this.choices.light]) : null;
    this.lighting.sky.visible = mode === 'walk';
    this.camera.fov = mode === 'walk' ? 58 : 42;
    this.camera.updateProjectionMatrix();
    this.renderer.shadowMap.needsUpdate = true;
  }

  /** Flies to the dollhouse or into a room. */
  goTo(view: View): void {
    this.target = view;
    if (view === 'maquette') {
      const from = this.camera.position.clone();
      const look = this.lookPoint();
      this.applyMode('dollhouse');
      const to = this.dollhousePosition();
      this.fly(from, to, look, DOLLHOUSE_TARGET.clone(), () => {
        this.orbit.target.copy(DOLLHOUSE_TARGET);
        this.orbit.update();
        this.arrive('maquette');
      });
      return;
    }
    this.enterRoom(view, false);
  }

  private enterRoom(id: RoomId, instant: boolean): void {
    const room = ROOMS.find((r) => r.id === id);
    if (!room) return;
    const to = new THREE.Vector3(room.eye[0], EYE, room.eye[1]);
    const look = new THREE.Vector3(...room.look);
    const done = () => {
      this.applyMode('walk');
      this.setLook(look);
      this.arrive(id);
    };
    if (instant) { this.camera.position.copy(to); done(); return; }
    // from the dollhouse: down into the room, walls still cut until the camera is inside
    this.fly(this.camera.position.clone(), to, this.lookPoint(), look, done);
  }

  private arrive(view: View): void {
    this.view = view;
    this.target = view;
    this.events.view(view);
    this.request();
  }

  private fly(from: THREE.Vector3, to: THREE.Vector3, fromLook: THREE.Vector3, toLook: THREE.Vector3, done: () => void): void {
    this.orbit.enabled = false;
    if (reduceMotion()) { this.camera.position.copy(to); this.camera.lookAt(toLook); done(); return; }
    this.flight = { from, to, fromLook, toLook, start: performance.now(), duration: 1300, done };
    this.request();
  }

  private lookPoint(): THREE.Vector3 {
    return this.camera.position.clone().add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(4));
  }

  private setLook(point: THREE.Vector3): void {
    const d = point.clone().sub(this.camera.position);
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    this.applyLook();
  }

  private applyLook(): void {
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.2, 1.2);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  // ---------- input ----------
  private bindInput(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, y: e.clientY, moved: false, yaw: this.yaw, pitch: this.pitch };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      if (Math.hypot(dx, dy) > 5) this.drag.moved = true;
      if (this.mode === 'walk' && this.drag.moved) {
        this.yaw = this.drag.yaw + dx * 0.0045;
        this.pitch = this.drag.pitch + dy * 0.0035;
        this.stroll = null;
        this.applyLook();
        this.request();
      }
    });
    canvas.addEventListener('pointerup', (e) => {
      const drag = this.drag;
      this.drag = null;
      if (!drag || drag.moved || this.flight) return;
      const hit = this.pick(e.clientX, e.clientY);
      if (!hit) return;
      if (this.mode === 'dollhouse') { const room = hit.object.userData.room as RoomId | undefined; if (room) this.goTo(room); return; }
      // walk mode: walk to the clicked spot on the floor
      this.stroll = { to: [hit.point.x, hit.point.z] };
      this.request();
    });
    canvas.addEventListener('keydown', (e) => {
      if (this.mode !== 'walk' || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(e.code)) return;
      e.preventDefault();
      this.keys.add(e.code);
      this.stroll = null;
      this.request();
    });
    canvas.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    canvas.addEventListener('blur', () => { this.keys.clear(); });
  }

  private pick(clientX: number, clientY: number): THREE.Intersection | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.intersectObjects(this.floors, false)[0] ?? null;
  }

  /** Moves the visitor by keyboard or toward a clicked spot; true while still moving. */
  private step(dt: number): boolean {
    if (this.mode !== 'walk') return false;
    const speed = 1.6 * dt;
    let dx = 0;
    let dz = 0;
    const fwd = (this.keys.has('ArrowUp') || this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('ArrowDown') || this.keys.has('KeyS') ? 1 : 0);
    const side = (this.keys.has('KeyD') || this.keys.has('KeyE') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('KeyQ') ? 1 : 0);
    const turn = (this.keys.has('ArrowLeft') ? 1 : 0) - (this.keys.has('ArrowRight') ? 1 : 0);
    if (turn) { this.yaw += turn * 1.8 * dt; this.applyLook(); }
    if (fwd || side) {
      dx = (-Math.sin(this.yaw) * fwd + Math.cos(this.yaw) * side) * speed;
      dz = (-Math.cos(this.yaw) * fwd - Math.sin(this.yaw) * side) * speed;
    } else if (this.stroll) {
      const [tx, tz] = this.stroll.to;
      const ddx = tx - this.camera.position.x;
      const ddz = tz - this.camera.position.z;
      const d = Math.hypot(ddx, ddz);
      if (d < 0.05) { this.stroll = null; return false; }
      const s = Math.min(d, speed * 1.3);
      dx = (ddx / d) * s;
      dz = (ddz / d) * s;
    }
    if (!dx && !dz) return turn !== 0;
    const [x, z] = walk([this.camera.position.x, this.camera.position.z], [dx, dz]);
    const blocked = Math.hypot(x - this.camera.position.x - dx, z - this.camera.position.z - dz) > speed * 0.9;
    this.camera.position.set(x, EYE, z);
    if (blocked && this.stroll) this.stroll = null;
    const room = roomAt(x, z)?.id;
    if (room && room !== this.view) this.arrive(room);
    return true;
  }

  // ---------- frames ----------
  /** Asks for a frame; animations keep asking while they run. */
  request(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame((t) => { this.frame = 0; this.tick(t); });
  }

  private tick(time: number): void {
    const dt = Math.min(0.05, this.lastTime ? (time - this.lastTime) / 1000 : 0.016);
    this.lastTime = time;
    let again = false;
    const f = this.flight;
    if (f) {
      const t = Math.min(1, (performance.now() - f.start) / f.duration);
      const k = ease(t);
      this.camera.position.lerpVectors(f.from, f.to, k);
      // a gentle arc: higher in the middle of the way down
      this.camera.position.y += Math.sin(Math.PI * t) * 0.6;
      this.camera.lookAt(new THREE.Vector3().lerpVectors(f.fromLook, f.toLook, k));
      if (t >= 1) { this.flight = null; f.done(); } else again = true;
    }
    if (this.mode === 'dollhouse' && !this.flight && this.orbit.update()) again = true;
    if (this.step(dt)) again = true;
    this.render();
    if (again) this.request(); else this.lastTime = 0;
  }

  private render(): void {
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    this.reportHotspots();
    const pose = this.mode === 'walk' ? { x: this.camera.position.x, z: this.camera.position.z, yaw: this.yaw } : null;
    const key = pose ? `${pose.x.toFixed(2)} ${pose.z.toFixed(2)} ${pose.yaw.toFixed(2)}` : '';
    if (key !== this.lastPose) { this.lastPose = key; this.events.pose(pose); }
    if (!this.readied) { this.readied = true; this.events.ready(); setTimeout(() => { this.warmUp(); }, 50); }
  }

  /**
   * Compiles the shaders of what the dollhouse does not show yet (full walls, ceilings, the street,
   * the sky) while the visitor looks at it, so that stepping into a room for the first time does not stall.
   */
  private warmUp(): void {
    const hidden = [...Object.values(this.groups), this.decor, this.lighting.sky].filter((o) => !o.visible);
    hidden.forEach((o) => { o.visible = true; });
    const compiling = this.renderer.compileAsync(this.scene, this.camera);
    hidden.forEach((o) => { o.visible = false; });
    compiling.catch(() => undefined);
  }

  private reportHotspots(): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const here = this.mode === 'walk' ? roomAt(this.camera.position.x, this.camera.position.z)?.id ?? 'sejour' : null;
    const list: HotspotOnScreen[] = [];
    for (const h of HOTSPOTS) {
      if (this.mode === 'walk' && h.room !== here) continue;
      if (this.mode === 'dollhouse' && h.at[1] > CUT + 0.6) continue;
      const p = new THREE.Vector3(...h.at).project(this.camera);
      if (p.z > 1 || Math.abs(p.x) > 0.96 || Math.abs(p.y) > 0.92) continue;
      list.push({ id: h.id, x: Math.round(((p.x + 1) / 2) * rect.width), y: Math.round(((1 - p.y) / 2) * rect.height) });
    }
    const key = JSON.stringify(list);
    if (key !== this.lastHotspots) { this.lastHotspots = key; this.events.hotspots(list); }
  }

  private resize(): void {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.request();
  }

  /** A JPEG of the current view, for the PDF and the image download. */
  capture(quality = 0.9): string {
    this.render();
    return this.renderer.domElement.toDataURL('image/jpeg', quality);
  }

  /** Where the walker stands (walk mode) for tests and the interface. */
  get position(): [number, number] { return [this.camera.position.x, this.camera.position.z]; }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.orbit.dispose();
    this.lighting.dispose();
    this.composer?.dispose();
    this.scene.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
