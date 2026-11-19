// Palmar Bay — Jax Carter on foot. A low-poly humanoid built from boxes,
// with a walk cycle, a sprint, a jump, and a pistol. Movement is relative
// to the camera, GTA-style: W walks away from the camera, S walks toward it.

import * as THREE from 'three';
import { PLAYER } from './config.js';
import { resolveCircleColliders } from './city.js';

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

export function makeHumanMesh({ shirt = 0xe86a2c, pants = 0x2b3440, skin = 0xd9a066, cap = 0x2e6f8e } = {}) {
  const group = new THREE.Group();
  // Legs (pivot at the hip so they can swing).
  const legL = new THREE.Group();
  legL.position.set(-0.14, 0.78, 0);
  legL.add(box(0.22, 0.78, 0.24, pants, 0, -0.39, 0));
  const legR = new THREE.Group();
  legR.position.set(0.14, 0.78, 0);
  legR.add(box(0.22, 0.78, 0.24, pants, 0, -0.39, 0));
  // Torso.
  const torso = box(0.62, 0.72, 0.34, shirt, 0, 1.14, 0);
  // Arms.
  const armL = new THREE.Group();
  armL.position.set(-0.4, 1.44, 0);
  armL.add(box(0.18, 0.66, 0.2, shirt, 0, -0.33, 0));
  const armR = new THREE.Group();
  armR.position.set(0.4, 1.44, 0);
  armR.add(box(0.18, 0.66, 0.2, shirt, 0, -0.33, 0));
  // Head and cap.
  const head = box(0.34, 0.34, 0.32, skin, 0, 1.72, 0);
  const capMesh = box(0.38, 0.1, 0.36, cap, 0, 1.92, 0);
  const brim = box(0.38, 0.05, 0.2, cap, 0, 1.88, 0.26);
  group.add(legL, legR, torso, armL, armR, head, capMesh, brim);
  group.userData = { legL, legR, armL, armR, torso };
  return group;
}

export function makePlayerMesh() {
  return makeHumanMesh({ shirt: 0xe86a2c, pants: 0x2b3440, skin: 0xd9a066, cap: 0x2e6f8e });
}

export class Player {
  constructor(scene, spawn) {
    this.mesh = makePlayerMesh();
    this.mesh.position.set(spawn.x, 0, spawn.z);
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.heading = 0;
    this.speed = 0;
    this.vy = 0;
    this.onGround = true;
    this.health = PLAYER.HEALTH_MAX;
    this.lastDamageAt = -99;
    this.walkPhase = 0;
    this.moving = false;
  }

  get forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  damage(amount, now) {
    // A brief breather after a hit: without it, a police car leaning on
    // the player (or three Vipers firing at once) melts the health bar in
    // a single frame, before the player can react.
    if (now - this.lastDamageAt < 0.35) return;
    this.health = Math.max(0, this.health - amount);
    this.lastDamageAt = now;
  }

  heal(amount) {
    this.health = Math.min(PLAYER.HEALTH_MAX, this.health + amount);
  }

  update(dt, input, camera, colliders, now) {
    const fwd = camera.forward;
    const right = camera.right;
    let mx = 0;
    let mz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) { mx += fwd.x; mz += fwd.z; }
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) { mx -= fwd.x; mz -= fwd.z; }
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) { mx += right.x; mz += right.z; }
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) { mx -= right.x; mz -= right.z; }
    const len = Math.hypot(mx, mz);
    this.moving = len > 0.01;
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const targetSpeed = this.moving ? (sprint ? PLAYER.SPRINT_SPEED : PLAYER.WALK_SPEED) : 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 8);
    if (this.moving) {
      mx /= len;
      mz /= len;
      const targetHeading = Math.atan2(mx, mz);
      let diff = targetHeading - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * Math.min(1, dt * 12);
      this.pos.x += mx * this.speed * dt;
      this.pos.z += mz * this.speed * dt;
    }

    // Jump and gravity.
    if (input.wasPressed('Space') && this.onGround) {
      this.vy = PLAYER.JUMP_SPEED;
      this.onGround = false;
    }
    this.vy -= PLAYER.GRAVITY * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.vy = 0;
      this.onGround = true;
    }

    // Buildings push the player out; the world edge does too.
    const solved = resolveCircleColliders(colliders, this.pos.x, this.pos.z, PLAYER.RADIUS);
    this.pos.x = Math.max(-268, Math.min(268, solved.x));
    this.pos.z = Math.max(-268, Math.min(320, solved.z));

    // Health regenerates after a quiet spell.
    if (now - this.lastDamageAt > PLAYER.HEALTH_REGEN_DELAY && this.health > 0) {
      this.heal(PLAYER.HEALTH_REGEN_RATE * dt);
    }

    // Walk cycle: legs and arms swing with speed.
    this.walkPhase += dt * this.speed * 1.6;
    const swing = Math.min(0.7, this.speed / PLAYER.SPRINT_SPEED) * 0.75;
    const { legL, legR, armL, armR } = this.mesh.userData;
    const s = Math.sin(this.walkPhase);
    legL.rotation.x = s * swing;
    legR.rotation.x = -s * swing;
    armL.rotation.x = -s * swing * 0.8;
    armR.rotation.x = s * swing * 0.8;
    this.mesh.rotation.y = this.heading;
  }
}
