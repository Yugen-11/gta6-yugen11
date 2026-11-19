// Palmar Bay — the third-person camera. It chases the player on foot or in
// a car, orbits with the mouse, zooms with the wheel, and smooths its motion
// so the view never snaps. No raycast collision: it lifts itself above the
// ground and pulls in when a building would swallow it. At speed the field
// of view opens a little, so a fast chase feels fast.

import * as THREE from 'three';
import { CAMERA as CAMERA_TUNING } from './config.js';

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.32;
    this.distance = 8.5;
    this.targetDistance = 8.5;
    this.position = new THREE.Vector3(0, 6, -12);
    this.lookAt = new THREE.Vector3();
    this.shake = 0;
  }

  get forward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  get right() {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  addShake(amount) {
    this.shake = Math.min(0.6, this.shake + amount);
  }

  update(dt, input, targetPos, targetHeading, driving, speed01 = 0) {
    // Mouse orbit.
    this.yaw -= input.mouseDX * 0.0032;
    this.pitch += input.mouseDY * 0.0024;
    this.pitch = Math.max(0.08, Math.min(1.15, this.pitch));
    // Wheel zoom.
    if (input.wheelDelta !== 0) {
      this.targetDistance = Math.max(5, Math.min(15, this.targetDistance + input.wheelDelta * 0.004));
    }
    this.distance += (this.targetDistance - this.distance) * Math.min(1, dt * 6);

    // In a car the camera trails behind it and swings back after a turn.
    // On foot the camera stays where the mouse put it; the player turns
    // toward the camera-relative movement direction instead.
    if (driving) {
      const desiredYaw = targetHeading + Math.PI;
      let diff = desiredYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 2.2);
    }

    const height = driving ? 3.4 : 2.6;
    const dist = driving ? this.distance + 2.5 : this.distance;
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch) * dist,
      Math.sin(this.pitch) * dist + height * 0.4,
      Math.cos(this.yaw) * Math.cos(this.pitch) * dist,
    );
    const desired = new THREE.Vector3().copy(targetPos).add(offset);
    desired.y = Math.max(desired.y, 1.6);
    const smooth = 1 - Math.exp(-dt * (driving ? 7 : 10));
    this.position.lerp(desired, smooth);

    this.lookAt.lerp(
      new THREE.Vector3(targetPos.x, targetPos.y + (driving ? 1.4 : 1.7), targetPos.z),
      1 - Math.exp(-dt * 12),
    );

    this.shake = Math.max(0, this.shake - dt * 1.8);
    const shakeX = (Math.random() - 0.5) * this.shake * 0.5;
    const shakeY = (Math.random() - 0.5) * this.shake * 0.5;
    this.camera.position.set(
      this.position.x + shakeX,
      this.position.y + shakeY,
      this.position.z,
    );
    this.camera.lookAt(this.lookAt);

    // The view opens up with speed, so a fast chase feels fast.
    const targetFov =
      CAMERA_TUNING.BASE_FOV + (driving ? speed01 * CAMERA_TUNING.SPEED_FOV_BONUS : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.updateProjectionMatrix();
    }
  }
}
