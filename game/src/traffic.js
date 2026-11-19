// Palmar Bay — the living streets: traffic cars that follow the road grid,
// parked cars waiting to be stolen, and pedestrians strolling the sidewalks
// who run when the shooting starts. Everything spawns near the player and
// despawns far away, so the city feels full without simulating all of it.

import * as THREE from 'three';
import { TRAFFIC, WORLD, CITY_HALF, CAR } from './config.js';
import { Car, randomCarColor } from './vehicles.js';
import { makeHumanMesh } from './player.js';
import { roadCentres, randomRoadPoint } from './city.js';
import { resolveCircleColliders } from './city.js';

const PED_SHIRTS = [0x4a6fa5, 0xd8c84a, 0x7a4a8a, 0x4a8a5a, 0xc05a4a, 0xe8e8e8, 0x3a3f45, 0xe8a0c0];
const PED_PANTS = [0x2b3440, 0x4a3a2b, 0x5a5a5a, 0x2b3a4a];
const PED_SKINS = [0xd9a066, 0x8a5a3a, 0xe8b88a, 0x6a4a2b];

function headingFor(axis, dir) {
  if (axis === 'x') return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  return dir > 0 ? 0 : Math.PI;
}

function laneOffset(heading, side = 2.8) {
  return { x: Math.cos(heading) * side, z: -Math.sin(heading) * side };
}

class TrafficCar {
  constructor(scene, rng, playerPos) {
    const kind = rng.pick(['sedan', 'sedan', 'sedan', 'taxi', 'van', 'truck', 'sport']);
    const p = this.pickRoadPoint(rng, playerPos);
    this.car = new Car(scene, kind, randomCarColor(kind, rng), p.x, p.z, p.heading);
    this.axis = p.axis;
    this.line = p.line;
    this.dir = p.dir;
    this.targetSpeed = TRAFFIC.CAR_SPEED + rng.range(-TRAFFIC.CAR_SPEED_VAR, TRAFFIC.CAR_SPEED_VAR);
    this.scene = scene;
    this.rng = rng;
  }

  pickRoadPoint(rng, playerPos) {
    for (let tries = 0; tries < 12; tries++) {
      const p = randomRoadPoint(rng);
      const dist = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
      if (dist > TRAFFIC.SPAWN_RADIUS_MIN && dist < TRAFFIC.SPAWN_RADIUS_MAX) {
        const dir = rng.chance(0.5) ? 1 : -1;
        const heading = headingFor(p.axis, dir);
        const off = laneOffset(heading);
        return { x: p.x + off.x, z: p.z + off.z, axis: p.axis, line: p.axis === 'x' ? p.z : p.x, dir, heading };
      }
    }
    const p = randomRoadPoint(rng);
    const dir = 1;
    const heading = headingFor(p.axis, dir);
    const off = laneOffset(heading);
    return { x: p.x + off.x, z: p.z + off.z, axis: p.axis, line: p.axis === 'x' ? p.z : p.x, dir, heading };
  }

  respawn(rng, playerPos) {
    const p = this.pickRoadPoint(rng, playerPos);
    this.car.pos.set(p.x, 0, p.z);
    this.car.heading = p.heading;
    this.car.speed = this.targetSpeed;
    this.axis = p.axis;
    this.line = p.line;
    this.dir = p.dir;
  }

  update(dt, rng, colliders, others, playerPos, playerCar) {
    const car = this.car;
    // At an intersection, sometimes turn onto the crossing road.
    const centres = roadCentres();
    const along = this.axis === 'x' ? car.pos.x : car.pos.z;
    for (const c of centres) {
      if (Math.abs(along - c) < 2.5 && rng.next() < 0.004) {
        const newAxis = this.axis === 'x' ? 'z' : 'x';
        const newDir = rng.chance(0.5) ? 1 : -1;
        const newHeading = headingFor(newAxis, newDir);
        const off = laneOffset(newHeading);
        this.axis = newAxis;
        this.line = c;
        this.dir = newDir;
        car.pos.x = newAxis === 'x' ? car.pos.x : c + off.x;
        car.pos.z = newAxis === 'z' ? car.pos.z : c + off.z;
        break;
      }
    }

    // Brake for the car (or the player) ahead.
    let targetSpeed = this.targetSpeed;
    const f = car.forward;
    const all = [...others, playerCar].filter(Boolean);
    for (const other of all) {
      if (other === car) continue;
      const ox = (other.pos?.x ?? other.x) - car.pos.x;
      const oz = (other.pos?.z ?? other.z) - car.pos.z;
      const ahead = ox * f.x + oz * f.z;
      const side = Math.abs(ox * -f.z + oz * f.x);
      if (ahead > 0 && ahead < 11 && side < 2.6) {
        targetSpeed = 0;
        break;
      }
    }

    const targetHeading = headingFor(this.axis, this.dir);
    car.driveToward(dt, targetHeading, targetSpeed, colliders, others);
    // Snap back onto the lane: the AI drives along the line, not freely.
    const off = laneOffset(car.heading);
    if (this.axis === 'x') car.pos.z += (this.line + off.z - car.pos.z) * Math.min(1, dt * 2);
    else car.pos.x += (this.line + off.x - car.pos.x) * Math.min(1, dt * 2);

    // Despawn far away, respawn near the player.
    const dist = Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z);
    if (dist > TRAFFIC.DESPAWN_RADIUS) this.respawn(rng, playerPos);
  }
}

class Pedestrian {
  constructor(scene, rng, playerPos) {
    const shirt = rng.pick(PED_SHIRTS);
    const pants = rng.pick(PED_PANTS);
    const skin = rng.pick(PED_SKINS);
    this.mesh = makeHumanMesh({ shirt, pants, skin, cap: rng.pick(PED_SHIRTS) });
    const p = this.pickSidewalkPoint(rng, playerPos);
    this.mesh.position.set(p.x, 0, p.z);
    this.mesh.scale.setScalar(rng.range(0.92, 1.08));
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.heading = rng.range(0, Math.PI * 2);
    this.speed = TRAFFIC.PED_SPEED + rng.range(-TRAFFIC.PED_SPEED_VAR, TRAFFIC.PED_SPEED_VAR);
    this.target = this.pickSidewalkPoint(rng, playerPos);
    this.state = 'walk';
    this.fleeTimer = 0;
    this.walkPhase = rng.range(0, 6);
    this.scene = scene;
    this.rng = rng;
  }

  pickSidewalkPoint(rng, playerPos) {
    for (let tries = 0; tries < 10; tries++) {
      const bi = rng.int(0, WORLD.GRID - 1);
      const bj = rng.int(0, WORLD.GRID - 1);
      const cx = (bi - (WORLD.GRID - 1) / 2) * WORLD.PITCH;
      const cz = (bj - (WORLD.GRID - 1) / 2) * WORLD.PITCH;
      if (cz + WORLD.BLOCK / 2 > WORLD.BEACH_Z) continue;
      const sx = rng.chance(0.5) ? 1 : -1;
      const sz = rng.chance(0.5) ? 1 : -1;
      const x = cx + sx * (WORLD.BLOCK / 2 + 2.5);
      const z = cz + sz * (WORLD.BLOCK / 2 + 2.5);
      if (Math.hypot(x - playerPos.x, z - playerPos.z) < TRAFFIC.DESPAWN_RADIUS) {
        return { x, z };
      }
    }
    return { x: playerPos.x + 20, z: playerPos.z };
  }

  scare(x, z) {
    const dist = Math.hypot(this.pos.x - x, this.pos.z - z);
    if (dist < 30) {
      this.state = 'flee';
      this.fleeTimer = 2.5;
      this.fleeFrom = { x, z };
    }
  }

  knockDown() {
    if (this.down) return;
    this.down = true;
    this.downTimer = 3;
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.position.y = 0.35;
  }

  update(dt, rng, colliders, playerPos) {
    if (this.down) {
      this.downTimer -= dt;
      if (this.downTimer <= 0) {
        this.down = false;
        this.mesh.rotation.x = 0;
        const p = this.pickSidewalkPoint(rng, playerPos);
        this.pos.set(p.x, 0, p.z);
        this.target = this.pickSidewalkPoint(rng, playerPos);
      }
      return;
    }
    let targetSpeed = this.speed;
    let tx;
    let tz;
    if (this.state === 'flee') {
      this.fleeTimer -= dt;
      const dx = this.pos.x - this.fleeFrom.x;
      const dz = this.pos.z - this.fleeFrom.z;
      const len = Math.hypot(dx, dz) || 1;
      tx = this.pos.x + (dx / len) * 10;
      tz = this.pos.z + (dz / len) * 10;
      targetSpeed = 4.4;
      if (this.fleeTimer <= 0) {
        this.state = 'walk';
        this.target = this.pickSidewalkPoint(rng, playerPos);
      }
    } else {
      tx = this.target.x;
      tz = this.target.z;
      if (Math.hypot(tx - this.pos.x, tz - this.pos.z) < 1.5) {
        this.target = this.pickSidewalkPoint(rng, playerPos);
      }
    }
    // Give the player room: a pedestrian walking into Jax steps aside
    // instead of passing straight through him.
    const dp = Math.hypot(this.pos.x - playerPos.x, this.pos.z - playerPos.z);
    if (dp < 2 && dp > 0.01) {
      tx = this.pos.x + ((this.pos.x - playerPos.x) / dp) * 4;
      tz = this.pos.z + ((this.pos.z - playerPos.z) / dp) * 4;
      targetSpeed = 2.5;
    }
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.05) {
      const targetHeading = Math.atan2(dx, dz);
      let diff = targetHeading - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * Math.min(1, dt * 6);
      this.pos.x += (dx / dist) * targetSpeed * dt;
      this.pos.z += (dz / dist) * targetSpeed * dt;
    }
    const solved = resolveCircleColliders(colliders, this.pos.x, this.pos.z, 0.5);
    this.pos.x = solved.x;
    this.pos.z = solved.z;
    this.mesh.rotation.y = this.heading;
    this.walkPhase += dt * targetSpeed * 1.8;
    const swing = Math.min(0.6, targetSpeed / 4) * 0.7;
    const s = Math.sin(this.walkPhase);
    const { legL, legR, armL, armR } = this.mesh.userData;
    legL.rotation.x = s * swing;
    legR.rotation.x = -s * swing;
    armL.rotation.x = -s * swing * 0.8;
    armR.rotation.x = s * swing * 0.8;

    const distToPlayer = Math.hypot(this.pos.x - playerPos.x, this.pos.z - playerPos.z);
    if (distToPlayer > TRAFFIC.DESPAWN_RADIUS) {
      const p = this.pickSidewalkPoint(rng, playerPos);
      this.pos.set(p.x, 0, p.z);
      this.target = this.pickSidewalkPoint(rng, playerPos);
    }
  }
}

export class TrafficManager {
  constructor(scene, rng, playerPos, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.trafficCars = [];
    for (let i = 0; i < TRAFFIC.CAR_COUNT; i++) {
      this.trafficCars.push(new TrafficCar(scene, rng, playerPos));
    }
    this.parkedCars = [];
    const parkedSpots = [
      { x: -203, z: -116, h: 0 },
      { x: -203, z: -58, h: Math.PI },
      { x: 203, z: 116, h: Math.PI / 2 },
      { x: 145, z: 203, h: 0 },
      { x: -29, z: 203, h: Math.PI },
      { x: 87, z: 58, h: Math.PI / 2 },
      { x: -145, z: -116, h: 0 },
      { x: 29, z: -203, h: -Math.PI / 2 },
    ];
    for (const spot of parkedSpots) {
      const kind = rng.pick(['sedan', 'sedan', 'sport', 'van', 'taxi']);
      const car = new Car(scene, kind, randomCarColor(kind, rng), spot.x, spot.z, spot.h);
      this.parkedCars.push(car);
    }
    this.peds = [];
    for (let i = 0; i < TRAFFIC.PED_COUNT; i++) {
      this.peds.push(new Pedestrian(scene, rng, playerPos));
    }
  }

  allCars() {
    return [...this.trafficCars.map((t) => t.car), ...this.parkedCars];
  }

  nearestEnterableCar(pos, radius) {
    let best = null;
    let bestDist = radius;
    for (const car of this.allCars()) {
      if (car.isPlayerCar) continue;
      const dist = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
      if (dist < bestDist) {
        bestDist = dist;
        best = car;
      }
    }
    return best;
  }

  scare(x, z) {
    for (const ped of this.peds) ped.scare(x, z);
  }

  update(dt, playerPos, playerCar) {
    const others = [...this.allCars(), playerCar].filter(Boolean);
    for (const t of this.trafficCars) {
      t.update(dt, this.rng, this.colliders, others, playerPos, playerCar);
    }
    for (const ped of this.peds) {
      ped.update(dt, this.rng, this.colliders, playerPos);
    }
  }
}
