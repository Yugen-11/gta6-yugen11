// Palmar Bay — the wanted system and the Palmar Bay Police Department.
// Crimes add heat; heat is stars; stars are police cars that chase and ram,
// and at three stars officers on foot who shoot. Lose the heat by staying
// out of sight, get busted when a cop corners you on foot.

import { WANTED } from './config.js';
import { Car, randomCarColor } from './vehicles.js';
import { Enemy } from './combat.js';
import { randomRoadPoint, nearestRoadPoint } from './city.js';

export class Police {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.heat = 0;
    this.stars = 0;
    this.cars = []; // { car, stuckTimer }
    this.copPeds = [];
    this.bustTimer = 0;
    this.sirenOn = false;
  }

  get wanted() {
    return this.stars;
  }

  addHeat(amount) {
    this.heat = Math.max(0, Math.min(WANTED.STARS, this.heat + amount));
    this.stars = this.heat > 0 ? Math.ceil(this.heat) : 0;
  }

  clear() {
    this.heat = 0;
    this.stars = 0;
    this.bustTimer = 0;
    for (const p of this.cars) p.car.remove(this.scene);
    for (const ped of this.copPeds) ped.remove();
    this.cars = [];
    this.copPeds = [];
    this.sirenOn = false;
  }

  spawnCarNear(playerPos) {
    // A road point 60–120 m from the player, so the pursuit starts close
    // enough to see but never on top of the player. The fallback is the
    // nearest road to the player, never a raw offset that could land
    // inside a building.
    let x = playerPos.x + 80;
    let z = playerPos.z;
    for (let tries = 0; tries < 24; tries++) {
      const q = randomRoadPoint(this.rng);
      const d = Math.hypot(q.x - playerPos.x, q.z - playerPos.z);
      if (d > 60 && d < 120) {
        x = q.x;
        z = q.z;
        break;
      }
      if (tries === 23) {
        const near = nearestRoadPoint(playerPos.x + 80, playerPos.z);
        x = near.x;
        z = near.z;
      }
    }
    const car = new Car(this.scene, 'police', randomCarColor('police', this.rng), x, z, 0);
    car.onCrash = () => {};
    this.cars.push({ car, stuckTimer: 0 });
    return car;
  }

  update(dt, playerPos, playerHeading, driving, playerCar, player, effects, hud, onBusted, now, others = []) {
    // Heat cools; faster when no police can see the player.
    const nearest = this.cars.reduce(
      (min, p) => Math.min(min, Math.hypot(p.car.pos.x - playerPos.x, p.car.pos.z - playerPos.z)),
      Infinity,
    );
    const hidden = nearest > 55;
    if (this.heat > 0) {
      this.heat = Math.max(
        0,
        this.heat - WANTED.DECAY_PER_SECOND * (hidden ? WANTED.DECAY_HIDDEN_MULT : 1) * dt,
      );
      this.stars = this.heat > 0 ? Math.ceil(this.heat) : 0;
    }

    // Keep the right number of police cars on the road.
    const want = Math.min(this.stars, WANTED.MAX_POLICE_CARS);
    while (this.cars.length < want) this.spawnCarNear(playerPos);
    while (this.cars.length > want) {
      const removed = this.cars.pop();
      removed.car.remove(this.scene);
    }
    this.sirenOn = this.cars.length > 0;

    const allCars = [...this.cars.map((p) => p.car), ...others];
    for (const entry of this.cars) {
      const car = entry.car;
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(dx, dz);
      // The police drive a little faster than the car they chase, and they
      // aim slightly ahead of a moving target so they can ram it.
      const lead = driving && playerCar ? Math.min(8, Math.abs(playerCar.speed) * 0.5) : 0;
      const aimX = playerPos.x + Math.sin(playerHeading) * lead;
      const aimZ = playerPos.z + Math.cos(playerHeading) * lead;
      const aimHeading = Math.atan2(aimX - car.pos.x, aimZ - car.pos.z);
      const targetSpeed = Math.min(42, 26 + this.stars * 3.5);
      car.driveToward(dt, aimHeading, dist < 4 ? 8 : targetSpeed, this.colliders, allCars);

      // A police car ramming the player on foot hurts.
      if (!driving && dist < 2.4 && Math.abs(car.speed) > 4) {
        player.damage(18, now);
        hud.flashDamage();
        const push = 6;
        player.pos.x += (dx / (dist || 1)) * -push * 0.3;
        player.pos.z += (dz / (dist || 1)) * -push * 0.3;
      }

      // Stuck against a building for too long: respawn the car near the player.
      if (Math.abs(car.speed) < 0.8 && dist > 12) {
        entry.stuckTimer += dt;
        if (entry.stuckTimer > 4) {
          const p = randomRoadPoint(this.rng);
          car.pos.set(p.x, 0, p.z);
          car.heading = targetHeading;
          car.speed = 10;
          entry.stuckTimer = 0;
        }
      } else {
        entry.stuckTimer = 0;
      }
    }

    // At three stars, officers get out and chase on foot with pistols.
    const wantCops = this.stars >= 3 ? 2 : 0;
    while (this.copPeds.length < wantCops) {
      const angle = this.rng.range(0, Math.PI * 2);
      const ped = new Enemy(
        this.scene,
        playerPos.x + Math.cos(angle) * 32,
        playerPos.z + Math.sin(angle) * 32,
        'cop',
      );
      this.copPeds.push(ped);
    }
    while (this.copPeds.length > wantCops) {
      const ped = this.copPeds.pop();
      ped.remove();
    }
    for (let i = this.copPeds.length - 1; i >= 0; i--) {
      const ped = this.copPeds[i];
      const done = ped.update(dt, playerPos, player, effects, () => hud.flashDamage(), this.colliders, now);
      if (ped.dead) this.addHeat(WANTED.KILL_COP_HEAT);
      if (done) {
        ped.remove();
        this.copPeds.splice(i, 1);
      }
    }

    // Busted: a cop stays right on top of the on-foot player.
    if (!driving && this.stars > 0) {
      let close = false;
      for (const entry of this.cars) {
        const d = Math.hypot(entry.car.pos.x - playerPos.x, entry.car.pos.z - playerPos.z);
        if (d < WANTED.BUST_DISTANCE && Math.abs(entry.car.speed) < 3) close = true;
      }
      for (const ped of this.copPeds) {
        if (Math.hypot(ped.pos.x - playerPos.x, ped.pos.z - playerPos.z) < WANTED.BUST_DISTANCE) close = true;
      }
      if (close) {
        this.bustTimer += dt;
        if (this.bustTimer > WANTED.BUST_TIME) onBusted();
      } else {
        this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
      }
    } else {
      this.bustTimer = 0;
    }
  }
}
