// Palmar Bay — cars. A low-poly car built from boxes, and the arcade
// driving model every car in the game shares: the player's car, the traffic
// cars and the police cars. Steering, grip, braking and collisions are all
// here; the traffic AI lives in traffic.js and only steers through it.

import * as THREE from 'three';
import { CAR } from './config.js';
import { resolveCircleColliders } from './city.js';

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

const MATS = {
  glass: new THREE.MeshLambertMaterial({ color: 0x16222e }),
  tyre: new THREE.MeshLambertMaterial({ color: 0x14161a }),
  chrome: new THREE.MeshLambertMaterial({ color: 0xd8dde2 }),
  lightFront: new THREE.MeshLambertMaterial({ color: 0xfff6cf, emissive: 0xffe9a8, emissiveIntensity: 0.7 }),
  lightRear: new THREE.MeshLambertMaterial({ color: 0xc01818, emissive: 0x881111, emissiveIntensity: 0.7 }),
  lightRed: new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1.4 }),
  lightBlue: new THREE.MeshLambertMaterial({ color: 0x2080ff, emissive: 0x2080ff, emissiveIntensity: 1.4 }),
};

const BODY_COLORS = {
  sedan: [0x4a6fa5, 0x8a4a5a, 0x5a7a5a, 0xb8b0a0, 0x3a3f45],
  sport: [0xd83a2c, 0xffc21c, 0x2c8ad8, 0xe8e8e8, 0x7a2cd8],
  taxi: [0xf2c018],
  van: [0xd8d8d8, 0x6a7a8a, 0x8a5a3a],
  truck: [0x7a7f85, 0x4a5a6a],
  police: [0xf2f2f2],
};

export function makeCarMesh(kind, color) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const tall = kind === 'van' || kind === 'truck';
  const long = kind === 'truck' ? 5.2 : 4.2;
  const wide = kind === 'truck' ? 2.2 : 1.9;

  // Body and cabin.
  group.add(box(wide, 0.55, long, bodyMat, 0, 0.55, 0));
  if (tall) {
    group.add(box(wide - 0.1, 0.9, long - 1.2, bodyMat, 0, 1.25, -0.3));
    group.add(box(wide - 0.3, 0.5, 0.9, MATS.glass, 0, 1.2, 1.5));
  } else {
    group.add(box(wide - 0.25, 0.5, 2.1, MATS.glass, 0, 1.02, -0.25));
    group.add(box(wide - 0.2, 0.06, 2.0, bodyMat, 0, 1.3, -0.25)); // roof
  }
  // Bumpers.
  group.add(box(wide + 0.06, 0.18, 0.18, MATS.chrome, 0, 0.42, long / 2));
  group.add(box(wide + 0.06, 0.18, 0.18, MATS.chrome, 0, 0.42, -long / 2));
  // Headlights and taillights.
  group.add(box(0.34, 0.14, 0.06, MATS.lightFront, -wide / 2 + 0.35, 0.62, long / 2 + 0.01));
  group.add(box(0.34, 0.14, 0.06, MATS.lightFront, wide / 2 - 0.35, 0.62, long / 2 + 0.01));
  group.add(box(0.34, 0.14, 0.06, MATS.lightRear, -wide / 2 + 0.35, 0.62, -long / 2 - 0.01));
  group.add(box(0.34, 0.14, 0.06, MATS.lightRear, wide / 2 - 0.35, 0.62, -long / 2 - 0.01));

  if (kind === 'taxi') {
    group.add(box(0.7, 0.22, 0.4, MATS.lightFront, 0, 1.42, -0.25));
  }
  if (kind === 'police') {
    group.add(box(0.5, 0.16, 0.3, MATS.lightRed, -0.3, 1.42, -0.25));
    group.add(box(0.5, 0.16, 0.3, MATS.lightBlue, 0.3, 1.42, -0.25));
    group.add(box(wide - 0.3, 0.3, 1.2, new THREE.MeshLambertMaterial({ color: 0x1a1d22 }), 0, 0.62, 0.4));
  }

  // Wheels: front pair steers, all four spin.
  const wheelGeometry = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10);
  wheelGeometry.rotateZ(Math.PI / 2);
  const wheels = [];
  const wheelGroups = [];
  for (const [x, z, front] of [
    [-wide / 2 + 0.1, 1.35, true],
    [wide / 2 - 0.1, 1.35, true],
    [-wide / 2 + 0.1, -1.35, false],
    [wide / 2 - 0.1, -1.35, false],
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.34, z);
    const wheel = new THREE.Mesh(wheelGeometry, MATS.tyre);
    wheel.castShadow = true;
    pivot.add(wheel);
    group.add(pivot);
    wheels.push(wheel);
    wheelGroups.push({ pivot, front });
  }
  group.userData = { wheels, wheelGroups, long, wide };
  return group;
}

export function randomCarColor(kind, rng) {
  const list = BODY_COLORS[kind] || BODY_COLORS.sedan;
  return list[Math.floor(rng.next() * list.length)];
}

export class Car {
  constructor(scene, kind, color, x, z, heading) {
    this.kind = kind;
    this.tuning = CAR.KINDS[kind];
    this.mesh = makeCarMesh(kind, color);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    this.mesh.traverse((child) => {
      child.userData.carRef = this;
    });
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.color = color;
    this.isPlayerCar = false;
    this.dead = false;
  }

  get forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  remove(scene) {
    scene.remove(this.mesh);
    this.dead = true;
  }

  // Player driving: input is the Input object, cameraYaw the camera's yaw.
  drive(dt, input, colliders, others) {
    const t = this.tuning;
    const throttle = (input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0)
      - (input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0);
    const steerTarget = ((input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0)
      - (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0)) * 0.55;
    const handbrake = input.isDown('Space');

    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 9);
    if (throttle > 0) {
      this.speed += t.accel * dt;
    } else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= t.brake * dt;
      else this.speed -= t.accel * 0.55 * dt; // reverse
    }
    // Drag and rolling resistance.
    this.speed -= this.speed * 0.32 * dt;
    if (Math.abs(this.speed) < 0.15 && throttle === 0) this.speed = 0;
    if (handbrake) {
      this.speed -= this.speed * 1.6 * dt;
    }
    this.speed = Math.max(-t.reverseSpeed, Math.min(t.topSpeed, this.speed));

    // Steering: sharper at speed, stronger with the handbrake, none stopped.
    const speedFactor = Math.min(1, Math.abs(this.speed) / 9);
    const turn = this.steer * speedFactor * (handbrake ? 1.7 : 1) * 0.9;
    this.heading += turn * dt * Math.sign(this.speed || 1);

    const f = this.forward;
    this.pos.x += f.x * this.speed * dt;
    this.pos.z += f.z * this.speed * dt;
    this.pos.x = Math.max(-268, Math.min(268, this.pos.x));
    this.pos.z = Math.max(-268, Math.min(322, this.pos.z));

    // Buildings: bounce off with a jolt. The crash force is the speed
    // before the bounce, not after it — the shake should match the hit.
    const solved = resolveCircleColliders(colliders, this.pos.x, this.pos.z, CAR.RADIUS);
    if (solved.hit) {
      this.pos.x = solved.x;
      this.pos.z = solved.z;
      const impact = Math.abs(this.speed);
      if (impact > 6) {
        this.speed *= -0.28;
      } else {
        this.speed *= 0.4;
      }
      this.onCrash?.(impact);
    }

    // Other cars: soft circle push.
    for (const other of others) {
      if (other === this || other.dead) continue;
      const dx = this.pos.x - other.pos.x;
      const dz = this.pos.z - other.pos.z;
      const dist = Math.hypot(dx, dz);
      const min = CAR.RADIUS * 2 - 0.4;
      if (dist > 0.01 && dist < min) {
        const push = (min - dist) / 2;
        const nx = dx / dist;
        const nz = dz / dist;
        this.pos.x += nx * push;
        this.pos.z += nz * push;
        other.pos.x -= nx * push;
        other.pos.z -= nz * push;
        const exchange = (this.speed - other.speed) * 0.25;
        this.speed -= exchange;
        other.speed += exchange;
        if (Math.abs(exchange) > 3) this.onCrash?.(Math.abs(exchange));
      }
    }

    this.mesh.rotation.y = this.heading;
    const { wheels, wheelGroups } = this.mesh.userData;
    for (const wheel of wheels) wheel.rotation.x += (this.speed * dt) / 0.34;
    for (const { pivot, front } of wheelGroups) {
      if (front) pivot.rotation.y = this.steer * 0.85;
    }
  }

  // AI driving: steer toward a heading at a target speed.
  driveToward(dt, targetHeading, targetSpeed, colliders, others) {
    let diff = targetHeading - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.steer += (Math.max(-0.55, Math.min(0.55, diff * 1.4)) - this.steer) * Math.min(1, dt * 6);
    const t = this.tuning;
    if (this.speed < targetSpeed) this.speed += t.accel * 0.7 * dt;
    else this.speed -= t.brake * 0.8 * dt;
    this.speed -= this.speed * 0.2 * dt;
    this.speed = Math.max(0, Math.min(t.topSpeed, this.speed));
    const turn = this.steer * Math.min(1, this.speed / 9) * 0.9;
    this.heading += turn * dt;
    const f = this.forward;
    this.pos.x += f.x * this.speed * dt;
    this.pos.z += f.z * this.speed * dt;
    const solved = resolveCircleColliders(colliders, this.pos.x, this.pos.z, CAR.RADIUS);
    if (solved.hit) {
      this.pos.x = solved.x;
      this.pos.z = solved.z;
      this.speed *= 0.3;
    }
    for (const other of others) {
      if (other === this || other.dead) continue;
      const dx = this.pos.x - other.pos.x;
      const dz = this.pos.z - other.pos.z;
      const dist = Math.hypot(dx, dz);
      const min = CAR.RADIUS * 2 - 0.4;
      if (dist > 0.01 && dist < min) {
        const push = (min - dist) / 2;
        this.pos.x += (dx / dist) * push;
        this.pos.z += (dz / dist) * push;
      }
    }
    this.mesh.rotation.y = this.heading;
    const { wheels, wheelGroups } = this.mesh.userData;
    for (const wheel of wheels) wheel.rotation.x += (this.speed * dt) / 0.34;
    for (const { pivot, front } of wheelGroups) {
      if (front) pivot.rotation.y = this.steer * 0.85;
    }
  }
}
