// The camera. Players only ever see the chase view: low behind the lizard, turning with it, the world comes at you.
// The top view (flat on, high up) is for development only: ?view=top, or et.setView(0) in the console.
import * as THREE from 'three';
import { shared } from './gfx';
import { DEG, angleDamp, angleDiff, clamp, damp, noise1, type V2 } from './util';

export interface View {
  id: 'top' | 'chase';
  pitch: number;
  fov: number;
  dist: number;
  /** Turns to stay behind the lizard. */
  follow: boolean;
  /** How far the camera looks ahead of a running lizard. */
  lead: number;
  /** Dust haze toward the far edge of the screen. */
  haze: number;
  /** How much far things fade into the dust of the place (0 none). */
  fog: number;
  /** The model-world blur at the far and near edges. */
  tilt: number;
}

export const VIEWS: View[] = [
  { id: 'top', pitch: 89.4, fov: 22, dist: 24, follow: false, lead: 0.2, haze: 0, fog: 0, tilt: 0 },
  { id: 'chase', pitch: 34, fov: 46, dist: 8.8, follow: true, lead: 0.34, haze: 0.3, fog: 0.9, tilt: 1 },
];

export class CameraRig {
  readonly cam = new THREE.PerspectiveCamera(24, 16 / 9, 0.5, 400);
  viewIndex = 1;
  yaw = 0;
  pitch = VIEWS[1].pitch;
  fov = VIEWS[1].fov;
  dist = VIEWS[1].dist;
  haze = 0;
  fog = 0;
  tilt = 0;
  zoom = 1;
  /** Extra pull-back or push-in from the game (hiding, being chased), eased. */
  mood = 1;
  focus: V2 = { x: 0, z: 0 };
  private lead: V2 = { x: 0, z: 0 };
  private trauma = 0;
  private kickX = 0;
  private kickZ = 0;
  private punch = 0;
  private t = 0;
  private handT = 0;
  private v = new THREE.Vector3();

  get view() { return VIEWS[this.viewIndex]; }

  setView(i: number, snap = false) {
    this.viewIndex = ((i % VIEWS.length) + VIEWS.length) % VIEWS.length;
    if (snap) { const v = this.view; this.pitch = v.pitch; this.fov = v.fov; this.dist = v.dist; this.haze = v.haze; this.fog = v.fog; this.tilt = v.tilt; if (!v.follow) this.yaw = 0; }
  }

  shake(amount: number) { this.trauma = Math.min(1, this.trauma + amount); }
  /** A shove in a direction (a hit, a landing). */
  kick(x: number, z: number) { this.kickX += x; this.kickZ += z; }
  /** A quick push in toward the action. */
  zoomPunch(amount: number) { this.punch = Math.max(this.punch, amount); }

  snapTo(x: number, z: number, heading = 0) {
    this.focus.x = x; this.focus.z = z; this.lead.x = this.lead.z = 0;
    if (this.view.follow) this.yaw = heading;
  }

  /** The player dragging the low camera round with a finger: by this much (radians, + right), at once. */
  turnBy(angle: number) {
    if (!angle || !this.view.follow) return;
    this.yaw += angle;
    this.handT = 1.4;
  }

  /** Turn stick or keys (right, down) into a direction on the ground, as this camera sees it. */
  toWorld(ix: number, iz: number, out: V2): V2 {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    out.x = c * ix - s * iz;
    out.z = s * ix + c * iz;
    return out;
  }

  /** turn: the player swinging the low camera round by hand (-1 left .. 1 right). */
  update(dt: number, target: V2, vel: V2, heading: number, mapW: number, mapH: number, aspect: number, moodTarget: number, turn = 0) {
    this.t += dt;
    const v = this.view;
    const k = 1 - Math.exp(-4.5 * dt);
    this.pitch += (v.pitch - this.pitch) * k;
    this.fov += (v.fov - this.fov) * k;
    this.dist += (v.dist - this.dist) * k;
    this.haze += (v.haze - this.haze) * k;
    this.fog += (v.fog - this.fog) * k;
    this.tilt += (v.tilt - this.tilt) * k;
    this.mood = damp(this.mood, moodTarget, 2.2, dt);
    this.punch = damp(this.punch, 0, 7, dt);

    const speed = Math.hypot(vel.x, vel.z);
    if (v.follow) {
      // Swing round behind the lizard, quickest when it runs across the view, not at all when it runs at the camera.
      // A hand on the camera wins, and it stays where it was put for a moment.
      this.handT = Math.abs(turn) > 0.1 ? 1.4 : Math.max(0, this.handT - dt);
      if (Math.abs(turn) > 0.1) this.yaw += turn * 2.4 * dt;
      else if (speed > 0.8 && this.handT <= 0) this.yaw += Math.sin(angleDiff(this.yaw, heading)) * 2.1 * dt * clamp(speed / 4, 0, 1);
    } else {
      this.yaw = angleDamp(this.yaw, 0, 5, dt);
    }

    this.lead.x = damp(this.lead.x, vel.x * v.lead, 2.6, dt);
    this.lead.z = damp(this.lead.z, vel.z * v.lead, 2.6, dt);
    let tx = target.x + this.lead.x, tz = target.z + this.lead.z;
    if (v.follow) { tx += Math.sin(this.yaw) * 1.6; tz -= Math.cos(this.yaw) * 1.6; }

    const d = this.dist * this.zoom * this.mood * (1 - this.punch * 0.08);
    const p = this.pitch * DEG, half = (this.fov * DEG) / 2;
    const h = d * Math.sin(p), back = d * Math.cos(p);
    if (!v.follow && Math.abs(this.yaw) < 0.05) {
      // Keep the view inside the map (a few tiles of the rocks beyond the edge may show).
      const m = 2.2;
      const south = back - h / Math.tan(Math.min(Math.PI - 0.01, p + half));
      const north = h / Math.tan(Math.max(0.05, p - half)) - back;
      const farRay = h / Math.sin(Math.max(0.05, p - half));
      const halfW = farRay * Math.tan(half) * aspect;
      tx = mapW + m * 2 < halfW * 2 ? mapW / 2 : clamp(tx, -m + halfW, mapW + m - halfW);
      tz = mapH + m * 2 < north + south ? mapH / 2 : clamp(tz, -m + north, mapH + m - south);
    }
    this.focus.x = damp(this.focus.x, tx, 7, dt);
    this.focus.z = damp(this.focus.z, tz, 7, dt);

    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    const sh = this.trauma * this.trauma;
    this.kickX = damp(this.kickX, 0, 12, dt);
    this.kickZ = damp(this.kickZ, 0, 12, dt);
    const ox = sh * 0.42 * noise1(this.t * 31, 1) + this.kickX;
    const oz = sh * 0.42 * noise1(this.t * 31, 2) + this.kickZ;

    const fx = this.focus.x + ox, fz = this.focus.z + oz;
    this.cam.fov = this.fov;
    this.cam.aspect = aspect;
    this.cam.position.set(fx - Math.sin(this.yaw) * back, h, fz + Math.cos(this.yaw) * back);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(fx, 0, fz);
    this.cam.rotateZ(sh * 0.035 * noise1(this.t * 27, 3));
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
    shared.uCamRight.value.set(Math.cos(this.yaw), Math.sin(this.yaw));
    // Standing cut-outs stand straight for the low camera and lean back to face one that looks down on them.
    const lean = clamp((this.pitch - 40) / 45, 0, 1) * (Math.PI / 2);
    shared.uCamUp.value.set(Math.sin(this.yaw) * Math.sin(lean), Math.cos(lean), -Math.cos(this.yaw) * Math.sin(lean));
  }

  /** Where a point in the world lands on the screen (0..1, y down). */
  toScreen(x: number, y: number, z: number, out: { x: number; y: number; on: boolean }) {
    this.v.set(x, y, z).project(this.cam);
    out.x = this.v.x * 0.5 + 0.5;
    out.y = 0.5 - this.v.y * 0.5;
    out.on = this.v.z < 1 && Math.abs(this.v.x) < 1.05 && Math.abs(this.v.y) < 1.05;
    return out;
  }
}
