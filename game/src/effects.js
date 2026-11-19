// Palmar Bay — the juice: impact particles, gun tracers and the muzzle
// flash. One small pool of boxes is reused for every burst, so a shootout
// never allocates a mesh mid-frame.

import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.pool = [];
    const geometry = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    for (let i = 0; i < 90; i++) {
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push(mesh);
    }
    this.tracers = [];
    const tracerGeometry = new THREE.BufferGeometry();
    tracerGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.tracerGeometry = tracerGeometry;
    // One shared material per tracer colour: a shot used to allocate (and
    // dispose) a fresh material every time, for a line that lives 0.07 s.
    this.tracerMaterials = {
      player: new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }),
      enemy: new THREE.LineBasicMaterial({ color: 0xffb0a0, transparent: true, opacity: 0.9 }),
    };
    this.muzzle = new THREE.PointLight(0xffc46b, 0, 14);
    scene.add(this.muzzle);
  }

  burst(pos, color, count = 12, speed = 6, up = 3.5) {
    for (let i = 0; i < count; i++) {
      const mesh = this.pool.pop();
      if (!mesh) return;
      mesh.visible = true;
      mesh.material.color.setHex(color);
      mesh.position.copy(pos);
      mesh.scale.setScalar(0.7 + Math.random() * 0.9);
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.active.push({
        mesh,
        vx: Math.cos(angle) * v,
        vy: up * (0.5 + Math.random()),
        vz: Math.sin(angle) * v,
        life: 0.5 + Math.random() * 0.4,
      });
    }
  }

  tracer(from, to, color = 0xffe9a8) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([from.x, from.y, from.z, to.x, to.y, to.z]), 3),
    );
    const line = new THREE.Line(
      geometry,
      color === 0xffb0a0 ? this.tracerMaterials.enemy : this.tracerMaterials.player,
    );
    this.scene.add(line);
    this.tracers.push({ line, life: 0.07 });
  }

  muzzleFlash(pos) {
    this.muzzle.position.copy(pos);
    this.muzzle.intensity = 7;
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.pool.push(p.mesh);
        this.active.splice(i, 1);
        continue;
      }
      p.vy -= 14 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.07) p.mesh.position.y = 0.07;
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        // The material is shared across tracers: never dispose it here.
        this.tracers.splice(i, 1);
      }
    }
    this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 90);
  }
}
