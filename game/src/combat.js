// Palmar Bay — combat: the player's pistol and the armed pedestrians who
// shoot back (Viper gang members and, at three stars, police officers).
// Shooting is a raycast from the camera through the crosshair; enemies are
// simple state machines that close in, shoot with imperfect aim, and fall.

import * as THREE from 'three';
import { COMBAT } from './config.js';
import { makeHumanMesh } from './player.js';
import { resolveCircleColliders } from './city.js';

const ENEMY_LOOKS = {
  viper: { shirt: 0x5a2a6a, pants: 0x1a1a22, skin: 0xd9a066, cap: 0x1a1a22 },
  cop: { shirt: 0x1e3a5f, pants: 0x1e3a5f, skin: 0xe8b88a, cap: 0x141c28 },
};

export class Enemy {
  constructor(scene, x, z, kind = 'viper') {
    this.kind = kind;
    this.mesh = makeHumanMesh(ENEMY_LOOKS[kind]);
    // A pistol in the right hand.
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.14, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x14161a }),
    );
    gun.position.set(0, -0.62, 0.12);
    this.mesh.userData.armR.add(gun);
    this.mesh.position.set(x, 0, z);
    this.mesh.traverse((child) => {
      child.userData.enemyRef = this;
    });
    scene.add(this.mesh);
    this.scene = scene;
    this.pos = this.mesh.position;
    this.heading = 0;
    this.health = COMBAT.ENEMY_HEALTH;
    this.shootTimer = 1 + Math.random();
    this.dead = false;
    this.removeTimer = 0;
    this.walkPhase = Math.random() * 6;
    this.shirtColor = ENEMY_LOOKS[kind].shirt;
    this.flashTimer = 0; // a hit flashes the shirt white, briefly
  }

  get gunPos() {
    return new THREE.Vector3(this.pos.x, 1.35, this.pos.z);
  }

  damage(amount) {
    if (this.dead) return false;
    this.health -= amount;
    // A hit the enemy survives flashes white, so the player sees the shot
    // land instead of wondering whether the pistol did anything.
    this.flashTimer = 0.12;
    if (this.health <= 0) {
      this.dead = true;
      this.removeTimer = 4;
      this.mesh.rotation.x = Math.PI / 2;
      this.mesh.position.y = 0.3;
      return true;
    }
    return false;
  }

  update(dt, playerPos, player, effects, onPlayerHit, colliders, now) {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.mesh.userData.torso.material.color.setHex(
        this.flashTimer > 0 ? 0xffffff : this.shirtColor,
      );
    }
    if (this.dead) {
      this.removeTimer -= dt;
      return this.removeTimer <= 0;
    }
    const dx = playerPos.x - this.pos.x;
    const dz = playerPos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const targetHeading = Math.atan2(dx, dz);
    let diff = targetHeading - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += diff * Math.min(1, dt * 8);

    // Close in until shooting range, then hold and fire.
    let speed = 0;
    if (dist > 26) speed = 4.2;
    else if (dist > 12) speed = 2.2;
    else if (dist < 6) speed = -1.5;
    this.pos.x += Math.sin(this.heading) * speed * dt;
    this.pos.z += Math.cos(this.heading) * speed * dt;
    const solved = resolveCircleColliders(colliders, this.pos.x, this.pos.z, 0.55);
    this.pos.x = solved.x;
    this.pos.z = solved.z;
    this.mesh.rotation.y = this.heading;

    this.walkPhase += dt * Math.abs(speed) * 1.8;
    const swing = Math.min(0.6, Math.abs(speed) / 4) * 0.7;
    const s = Math.sin(this.walkPhase);
    const { legL, legR, armL, armR } = this.mesh.userData;
    legL.rotation.x = s * swing;
    legR.rotation.x = -s * swing;
    armL.rotation.x = -s * swing * 0.8;
    armR.rotation.x = dist < COMBAT.ENEMY_RANGE ? -1.2 : s * swing * 0.8; // aim when close

    if (dist < COMBAT.ENEMY_RANGE) {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = COMBAT.ENEMY_SHOT_INTERVAL * (0.8 + Math.random() * 0.5);
        const from = this.gunPos;
        const hit = Math.random() < COMBAT.ENEMY_ACCURACY * Math.max(0.35, 1 - dist / 70);
        const to = hit
          ? new THREE.Vector3(playerPos.x, 1.2, playerPos.z)
          : new THREE.Vector3(
              playerPos.x + (Math.random() - 0.5) * 4,
              1.2 + (Math.random() - 0.5) * 2,
              playerPos.z + (Math.random() - 0.5) * 4,
            );
        effects.tracer(from, to, 0xffb0a0);
        effects.muzzleFlash(from);
        if (hit) {
          player.damage(COMBAT.ENEMY_DAMAGE, now);
          onPlayerHit();
        }
      }
    }
    return false;
  }

  remove() {
    this.scene.remove(this.mesh);
  }
}

export class Combat {
  constructor(scene, camera, effects) {
    this.scene = scene;
    this.camera = camera;
    this.effects = effects;
    this.raycaster = new THREE.Raycaster();
    this.cooldown = 0;
  }

  get ready() {
    return this.cooldown <= 0;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  // The player fires through the crosshair. Returns what the bullet hit.
  playerShoot(playerPos, shootables) {
    if (!this.ready) return null;
    this.cooldown = COMBAT.PISTOL_COOLDOWN;
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    this.raycaster.far = COMBAT.PISTOL_RANGE;
    const hits = this.raycaster.intersectObjects(shootables, true);
    const from = new THREE.Vector3(
      playerPos.x + Math.sin(this.camera.rotation.y) * 0.4,
      1.35,
      playerPos.z + Math.cos(this.camera.rotation.y) * 0.4,
    );
    let to;
    let hit = null;
    if (hits.length > 0) {
      const first = hits[0];
      to = first.point.clone();
      let node = first.object;
      while (node && !node.userData.enemyRef && !node.userData.carRef && !node.userData.building) {
        node = node.parent;
      }
      if (node?.userData.enemyRef) {
        const enemy = node.userData.enemyRef;
        const died = enemy.damage(COMBAT.PISTOL_DAMAGE);
        this.effects.burst(to, 0xc01818, 10, 5, 2);
        hit = { type: 'enemy', enemy, died };
      } else if (node?.userData.carRef) {
        this.effects.burst(to, 0xffd23e, 8, 5, 2);
        hit = { type: 'car', car: node.userData.carRef };
      } else {
        this.effects.burst(to, 0xd8d0c0, 6, 3, 1.5);
        hit = { type: 'world' };
      }
    } else {
      to = this.raycaster.ray.at(COMBAT.PISTOL_RANGE, new THREE.Vector3());
      hit = { type: 'miss' };
    }
    this.effects.tracer(from, to);
    this.effects.muzzleFlash(from);
    return hit;
  }
}
