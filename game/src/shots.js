// Palmar Bay — the screenshot scenes behind ?shot=cover|street|mission|
// wanted. Each one plays the real rules forward from a fresh game for a
// fixed settle time, steered by a small autopilot that holds the keys a
// player would hold, so the frame is what a short session really looks like
// and the same seed always gives the same frame.
//
// This is a maker tool only: it never runs without ?shot= in the URL, and
// it never changes the rules of the game — the autopilot only presses keys,
// and the staging safeguards (health pinned, no bust mid-frame) keep a
// still from being ruined by a death that has nothing to do with the shot.

import { Car } from './vehicles.js';

const SHOTS = {
  // The cover: a three-star chase down the long north avenue, shot from a
  // camera ahead of the player car looking back, so the PBPD cars closing
  // in behind it are in the frame. The autopilot cruises at about 31 m/s —
  // fast enough to look fast, slow enough for the police (36.5 m/s) to
  // catch up and ride right behind the player car.
  cover: {
    settle: 7,
    frontCamera: true,
    setup(ctx) {
      ctx.missions.start(3); // Hot Pursuit — the heat is on at once
      const car = new Car(ctx.scene, 'sport', 0xffc21c, 29, 120, Math.PI);
      ctx.game.looseCars.push(car);
      ctx.enterCar(car, false);
      ctx.game.money = 1250;
      // Heat on from the first frame (see the wanted shot: police.update
      // runs before the mission's own heat and would pop a staged car).
      ctx.police.addHeat(3);
      // One PBPD car staged right behind the player car, already closing
      // in: a real police car, and the pursuit AI takes over from the
      // first frame, so the chase is in the frame from the start.
      const escort = ctx.police.spawnCarNear(ctx.player.pos);
      escort.pos.set(29, 0, 145);
      escort.heading = Math.PI; // north, toward the player car
      escort.speed = 30;
      return { roadX: 29, stuckTimer: 0, reverseTimer: 0 };
    },
    drive(dt, ctx, state) {
      const { input, game } = ctx;
      const car = game.playerCar;
      if (!car) return;
      // Lane keeping on the avenue, with a pass around a car ahead.
      const f = car.forward;
      const right = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
      let targetX = state.roadX;
      for (const other of ctx.traffic.allCars()) {
        if (other === car || other.dead) continue;
        const dx = other.pos.x - car.pos.x;
        const dz = other.pos.z - car.pos.z;
        const along = dx * f.x + dz * f.z;
        const side = Math.abs(dx * -f.z + dz * f.x);
        if (along > 0 && along < 30 && side < 4.5) {
          const lat = dx * right.x + dz * right.z;
          // The blocker is on our right: pass on the left, and vice versa.
          // A small offset keeps the car on the asphalt and off the
          // sidewalk, where the pedestrians walk.
          targetX = state.roadX + (lat > 0 ? -2.5 : 2.5) * right.x;
          break;
        }
      }
      // Stuck against something: reverse out for a second, then carry on.
      if (Math.abs(car.speed) < 2) {
        state.stuckTimer += dt;
      } else {
        state.stuckTimer = 0;
      }
      if (state.stuckTimer > 2) {
        state.reverseTimer = 1;
        state.stuckTimer = 0;
      }
      if (state.reverseTimer > 0) {
        state.reverseTimer -= dt;
        input.keys.add('KeyS');
        input.keys.delete('KeyW');
      } else if (car.speed < 31) {
        // Cruise control: fast, but the police can catch up.
        input.keys.add('KeyW');
        input.keys.delete('KeyS');
      } else {
        input.keys.delete('KeyW');
        input.keys.delete('KeyS');
      }
      // Steer toward the lane: a heading change moves the car sideways by
      // cos(heading), so the key follows the sign of error * cos(heading).
      const errorX = targetX - car.pos.x;
      input.keys.delete('KeyA');
      input.keys.delete('KeyD');
      if (Math.abs(errorX) > 0.6) {
        if (errorX * Math.cos(car.heading) > 0) input.keys.add('KeyD');
        else input.keys.add('KeyA');
      }
    },
    // A movie camera: ahead of the car, off to one side, looking back at
    // it — the pursuit streams in behind the player car.
    afterCamera(ctx) {
      const car = ctx.game.playerCar;
      if (!car) return;
      const f = car.forward;
      const right = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
      ctx.camera.position.set(
        car.pos.x + f.x * 13 - right.x * 4,
        3.2,
        car.pos.z + f.z * 13 - right.z * 4,
      );
      ctx.camera.lookAt(car.pos.x, 1.3, car.pos.z);
    },
  },

  // On foot downtown: Jax walks the avenue toward Rosa's Cafe while
  // traffic and pedestrians pass, mission 1's beacon ahead.
  street: {
    settle: 6,
    setup(ctx) {
      ctx.missions.start(0);
      ctx.player.pos.set(-87, 0, 40);
      ctx.player.mesh.position.copy(ctx.player.pos);
      ctx.player.heading = Math.PI;
      ctx.chaseCamera.yaw = 0;
      ctx.chaseCamera.targetDistance = 9;
      ctx.chaseCamera.pitch = 0.3;
      return {};
    },
    drive(dt, ctx) {
      ctx.input.keys.add('KeyW');
    },
  },

  // Mission 2, Borrowed Wheels: Jax on foot at Comet Motors, the red Comet
  // GT on the lot and the beacon over the dealership. Close in, with the
  // COMET MOTORS sign behind the car.
  mission: {
    settle: 6,
    setup(ctx) {
      ctx.missions.start(1);
      ctx.player.pos.set(145, 0, -14);
      ctx.player.mesh.position.copy(ctx.player.pos);
      ctx.player.heading = 0;
      ctx.chaseCamera.yaw = -0.5;
      ctx.chaseCamera.targetDistance = 8;
      ctx.chaseCamera.pitch = 0.28;
      return {};
    },
    drive() {
      // Stand and look at the car: no keys, the scene does the talking.
    },
  },

  // Three stars on foot at a downtown intersection: a PBPD car staged on
  // the avenue bears down on Jax while officers close in on foot. The
  // settle is short, so the patrol car is still closing in when the frame
  // is taken — a longer settle lets it ram Jax and fill the bottom of the
  // frame instead.
  wanted: {
    settle: 1,
    setup(ctx) {
      ctx.missions.start(3); // Hot Pursuit — the heat is on at once
      ctx.player.pos.set(29, 0, 87);
      ctx.player.mesh.position.copy(ctx.player.pos);
      ctx.player.heading = 0;
      ctx.chaseCamera.yaw = 0.15;
      ctx.chaseCamera.targetDistance = 10;
      ctx.chaseCamera.pitch = 0.32;
      ctx.game.money = 650;
      // Heat on from the first frame: police.update runs before the
      // mission's own heat, and with no stars yet it would pop a staged
      // car straight back out of the scene.
      ctx.police.addHeat(3);
      // One PBPD car staged up the avenue, driving straight at Jax: a real
      // police car, and the pursuit AI takes over from the first frame.
      const patrol = ctx.police.spawnCarNear(ctx.player.pos);
      patrol.pos.set(29, 0, 32);
      patrol.heading = 0; // south, toward Jax
      patrol.speed = 25;
      return {};
    },
    drive() {
      // Stand in the street and let the pursuit come to Jax.
    },
  },
};

/**
 * Stage the named shot, or return null when there is none (normal play).
 * `ctx` is the live game: { game, player, city, chaseCamera, input,
 * traffic, police, missions, hud, audio, scene, rng, renderer, camera,
 * enterCar, startNewGame }. The returned driver is called once per frame while the
 * game is playing; it raises window.__shotReady when the scene has settled.
 *
 * Headless software rendering is slow (about 1.3 fps at full quality), so
 * the settle runs at half pixel ratio and the driver restores full quality
 * for the last three frames before raising the flag: the captured frame is
 * a full-quality render of the real game, only the staging frames are cheap.
 */
export function stageShot(name, ctx) {
  const def = SHOTS[name];
  if (!def) return null;
  ctx.startNewGame();
  // The fresh game's mission-1 intro would talk over the shot's own
  // mission: drop it, then start the shot's mission instead. The new-game
  // toast names mission 1 too, so clear it as well.
  ctx.missions.dialogueQueue.length = 0;
  ctx.missions.dialogueTimer = 0;
  ctx.hud.toastTimer = 0.01;
  const state = def.setup(ctx);
  const fullRatio = Math.min(window.devicePixelRatio, 1.5);
  ctx.renderer.setPixelRatio(0.5);
  ctx.renderer.setSize(window.innerWidth, window.innerHeight);
  let elapsed = 0;
  let ready = false;
  let restoreFrames = -1;
  const driver = {
    update(dt) {
      if (ready) return;
      if (restoreFrames >= 0) {
        // Full-quality frames after restoring the pixel ratio.
        restoreFrames++;
        if (restoreFrames >= 3) {
          ready = true;
          window.__shotReady = true;
          window.__shotName = name;
        }
        return;
      }
      elapsed += dt;
      def.drive(dt, ctx, state, elapsed);
      // Staging safeguards: a still is never ruined by a death or a bust
      // that has nothing to do with the shot.
      ctx.player.health = 100;
      ctx.police.bustTimer = 0;
      if (elapsed >= def.settle) {
        ctx.renderer.setPixelRatio(fullRatio);
        ctx.renderer.setSize(window.innerWidth, window.innerHeight);
        restoreFrames = 0;
      }
    },
  };
  // A shot may place its own camera after the chase camera has run, so the
  // frame shows the scene from the angle the shot wants. It stays in place
  // once the shot has settled, so the captured frame keeps that angle.
  if (def.afterCamera) {
    driver.afterCamera = () => def.afterCamera(ctx);
  }
  return driver;
}
