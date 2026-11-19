// Palmar Bay — the entry point: renderer, game loop, state machine (menu,
// playing, paused, busted, wasted, complete) and the wiring between the
// city, the player, the cars, the traffic, the police, the combat, the
// missions, the audio, the save and the HUD.

import * as THREE from 'three';
import { CAR, WANTED, CAMERA as CAMERA_TUNING } from './config.js';
import { makeRng } from './random.js';
import { buildCity, LOCATIONS as CITY_LOCATIONS } from './city.js';
import { Player } from './player.js';
import { ChaseCamera } from './camera.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { TrafficManager } from './traffic.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Effects } from './effects.js';
import { MissionManager } from './missions.js';
import { AudioEngine } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CAMERA_TUNING.BASE_FOV, window.innerWidth / window.innerHeight, 0.1, 1400);

const rng = makeRng(20261118);
const city = buildCity(scene, rng);
const input = new Input(canvas);
const hud = new Hud();
hud.setGroundImage(city.groundTexture.image);
const effects = new Effects(scene);
const combat = new Combat(scene, camera, effects);
const audio = new AudioEngine();

const player = new Player(scene, { x: CITY_LOCATIONS.cafe.x + 6, z: CITY_LOCATIONS.cafe.z + 4 });
const chaseCamera = new ChaseCamera(camera);
const traffic = new TrafficManager(scene, rng, player.pos, city.colliders);
const police = new Police(scene, rng, city.colliders);

// Game state. The HUD and the menus read this; the missions and the police
// write to it as they arrive.
const game = {
  mode: 'menu', // menu | playing | paused | busted | wasted | complete
  money: 0,
  health: 100,
  driving: false,
  playerCar: null,
  looseCars: [], // cars the player exited or was given: still enterable
  speedMph: 0,
  objective: 'Welcome to Palmar Bay.',
  missionName: '',
  missionBlip: null,
  traffic: [],
  police: [],
  enemies: [], // mission enemies, updated here and by the police
  time: 0,
};

function saveGame() {
  writeSave({
    money: game.money,
    missionIndex: missions.index,
    playerX: player.pos.x,
    playerZ: player.pos.z,
    muted: audio.muted,
    completed: missions.done,
  });
}

const missions = new MissionManager(scene, rng.fork(7), {
  game,
  hud,
  police,
  traffic,
  effects,
  audio,
  onSave: saveGame,
  onAllComplete: () => {
    game.mode = 'complete';
    document.getElementById('complete').classList.remove('hidden');
    hud.hide();
    saveGame();
  },
});

function enterCar(car, stolen) {
  game.playerCar = car;
  game.driving = true;
  car.isPlayerCar = true;
  player.mesh.visible = false;
  player.pos.set(car.pos.x, 0, car.pos.z);
  player.heading = car.heading;
  chaseCamera.yaw = car.heading + Math.PI;
  if (stolen) {
    police.addHeat(CAR.STEAL_HEAT);
    hud.showToast('Car stolen! The cops are watching.');
  }
}

function exitCar() {
  const car = game.playerCar;
  if (!car) return;
  game.playerCar = null;
  game.driving = false;
  car.isPlayerCar = false;
  car.speed = 0;
  const f = car.forward;
  player.pos.set(car.pos.x - f.x * 3, 0, car.pos.z - f.z * 3);
  player.heading = car.heading;
  player.mesh.visible = true;
  player.mesh.position.copy(player.pos);
  if (!game.looseCars.includes(car)) game.looseCars.push(car);
}

function tryEnterCar() {
  const candidates = [
    ...traffic.allCars(),
    ...game.looseCars,
    ...police.cars.map((p) => p.car),
  ];
  let best = null;
  let bestDist = CAR.ENTER_RADIUS;
  for (const car of candidates) {
    if (car.isPlayerCar || car.dead) continue;
    const dist = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
    if (dist < bestDist) {
      bestDist = dist;
      best = car;
    }
  }
  if (!best) return;
  // A moving traffic car loses its driver; a parked car is simply taken;
  // a police car leaves the pursuit when it is stolen.
  const wrapper = traffic.trafficCars.find((t) => t.car === best);
  if (wrapper) {
    traffic.trafficCars.splice(traffic.trafficCars.indexOf(wrapper), 1);
    game.looseCars.push(best);
  } else {
    const parkedIndex = traffic.parkedCars.indexOf(best);
    if (parkedIndex !== -1) traffic.parkedCars.splice(parkedIndex, 1);
    const policeIndex = police.cars.findIndex((p) => p.car === best);
    if (policeIndex !== -1) police.cars.splice(policeIndex, 1);
    if (!game.looseCars.includes(best)) game.looseCars.push(best);
  }
  enterCar(best, true);
}

function busted() {
  if (game.mode !== 'playing') return;
  game.mode = 'busted';
  const fine = Math.min(game.money, WANTED.BUST_FINE);
  game.money -= fine;
  police.clear();
  if (game.driving) exitCar();
  missions.resetCurrent();
  saveGame();
  document.getElementById('busted').classList.remove('hidden');
  hud.hide();
}

function wasted() {
  if (game.mode !== 'playing') return;
  game.mode = 'wasted';
  const fine = Math.min(game.money, WANTED.WASTED_FINE);
  game.money -= fine;
  police.clear();
  if (game.driving) exitCar();
  missions.resetCurrent();
  saveGame();
  document.getElementById('wasted').classList.remove('hidden');
  hud.hide();
}

function respawnAt(loc) {
  player.pos.set(loc.x, 0, loc.z);
  player.mesh.position.copy(player.pos);
  player.heading = 0;
  player.health = 100;
  player.mesh.visible = true;
  document.getElementById('busted').classList.add('hidden');
  document.getElementById('wasted').classList.add('hidden');
  hud.show();
  game.mode = 'playing';
  chaseCamera.yaw = player.heading + Math.PI;
  chaseCamera.position.set(player.pos.x, 5, player.pos.z - 10);
}

// Menu orbit: the city turns slowly behind the title screen.
let menuAngle = 0.6;

function startGame() {
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('pause').classList.add('hidden');
  document.getElementById('busted').classList.add('hidden');
  document.getElementById('wasted').classList.add('hidden');
  document.getElementById('complete').classList.add('hidden');
  hud.show();
  game.mode = 'playing';
  chaseCamera.yaw = player.heading + Math.PI;
  chaseCamera.pitch = 0.32;
  chaseCamera.position.set(player.pos.x, 5, player.pos.z - 10);
}

function startNewGame() {
  clearSave();
  game.money = 0;
  game.enemies.forEach((e) => e.remove());
  game.enemies = [];
  player.pos.set(CITY_LOCATIONS.cafe.x + 6, 0, CITY_LOCATIONS.cafe.z + 4);
  player.mesh.position.copy(player.pos);
  player.heading = 0;
  player.health = 100;
  police.clear();
  audio.unlock();
  missions.start(0);
  hud.showToast('Mission 1: First Fare — pick up the client at Rosa\'s Cafe.', 5);
  startGame();
}

function continueGame() {
  const save = loadSave();
  if (!save) return;
  game.money = save.money;
  audio.setMuted(save.muted);
  if (save.playerX !== null && save.playerZ !== null) {
    player.pos.set(save.playerX, 0, save.playerZ);
    player.mesh.position.copy(player.pos);
  }
  player.health = 100;
  police.clear();
  audio.unlock();
  missions.start(save.missionIndex);
  startGame();
}

function pauseGame() {
  if (game.mode !== 'playing') return;
  game.mode = 'paused';
  saveGame();
  document.getElementById('pause-stats').textContent =
    `$${Math.floor(game.money).toLocaleString('en-US')} earned  •  Mission ${Math.min(missions.index + 1, 6)} of 6` +
    (missions.done ? '  •  Story complete' : '');
  document.getElementById('pause').classList.remove('hidden');
  hud.hide();
}

function resumeGame() {
  document.getElementById('pause').classList.add('hidden');
  hud.show();
  game.mode = 'playing';
}

// A save from an earlier session offers Continue on the title screen.
const existingSave = loadSave();
if (existingSave) {
  document.getElementById('btn-continue').classList.remove('hidden');
  if (existingSave.muted) audio.setMuted(true);
}

document.getElementById('btn-new').addEventListener('click', startNewGame);
document.getElementById('btn-continue').addEventListener('click', continueGame);
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-quit').addEventListener('click', () => {
  saveGame();
  document.getElementById('pause').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
  game.mode = 'menu';
});
document.getElementById('btn-busted').addEventListener('click', () => respawnAt(CITY_LOCATIONS.policeStation));
document.getElementById('btn-wasted').addEventListener('click', () => respawnAt(CITY_LOCATIONS.hospital));
document.getElementById('btn-freeroam').addEventListener('click', startGame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// For the smoke test and the screenshot presets: the whole game, live.
window.__game = {
  renderer, scene, camera, game, player, city, chaseCamera, hud, input, traffic, police,
  combat, effects, missions, audio, THREE, LOCATIONS: CITY_LOCATIONS,
  enterCar, exitCar, busted, wasted, startNewGame, continueGame, saveGame,
};

// Screenshot presets: ?shot=cover|street|mission|wanted stages a scene
// from the real game and raises window.__shotReady when it has settled.
// No query parameter means normal play, and the game never notices.
window.__shotReady = false;
window.__shotName = null;
const shotDriver = stageShot(new URLSearchParams(location.search).get('shot'), {
  game, player, city, chaseCamera, input, traffic, police, missions, hud, audio, scene, rng, renderer, camera,
  enterCar, startNewGame,
});

let lastNow = performance.now();
let errors = 0;
let autosaveTimer = 0;
window.addEventListener('error', () => {
  errors += 1;
});

renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
  lastNow = now;
  game.time += dt;

  if (game.mode === 'menu') {
    menuAngle += dt * 0.045;
    camera.position.set(
      Math.cos(menuAngle) * 195,
      84,
      Math.sin(menuAngle) * 195 - 20,
    );
    camera.lookAt(0, 8, 0);
    city.update(dt, game.time);
  } else if (game.mode === 'complete') {
    city.update(dt, game.time);
  } else if (game.mode === 'playing') {
    // A screenshot preset steers the game for its settle time.
    shotDriver?.update(dt);
    if (input.wasPressed('Escape') || input.wasPressed('KeyP')) pauseGame();
    if (input.wasPressed('KeyM')) {
      audio.setMuted(!audio.muted);
      hud.showToast(audio.muted ? 'Sound muted.' : 'Sound on.');
    }
    if (input.wasPressed('KeyH') && game.driving) audio.horn();

    const physicsCars = [
      ...traffic.allCars(),
      ...game.looseCars,
      ...police.cars.map((p) => p.car),
      game.playerCar,
    ].filter(Boolean);
    const playerProxy = game.driving ? game.playerCar : { pos: player.pos };
    traffic.update(dt, player.pos, playerProxy);

    if (game.driving && game.playerCar) {
      const car = game.playerCar;
      car.onCrash = (force) => {
        if (force > 4) chaseCamera.addShake(0.25);
      };
      car.drive(dt, input, city.colliders, physicsCars);
      player.pos.set(car.pos.x, 0, car.pos.z);
      player.heading = car.heading;
      game.speedMph = Math.abs(car.speed) * 2.237;
      // Running over a pedestrian: a crime, and the street notices.
      for (const ped of traffic.peds) {
        if (ped.down) continue;
        const dist = Math.hypot(ped.pos.x - car.pos.x, ped.pos.z - car.pos.z);
        if (dist < 2.4 && Math.abs(car.speed) > 3) {
          ped.knockDown();
          police.addHeat(WANTED.HIT_PED_HEAT);
          traffic.scare(car.pos.x, car.pos.z);
          hud.showToast('Pedestrian hit! Wanted level rising.');
          chaseCamera.addShake(0.3);
        }
      }
      if (input.wasPressed('KeyE')) exitCar();
    } else {
      player.update(dt, input, chaseCamera, city.colliders, game.time);
      game.speedMph = 0;
      if (input.wasPressed('KeyE')) tryEnterCar();
      // Pistol: left click fires through the crosshair.
      if (input.mouseClicked && combat.ready) {
        const shootables = [
          city.ground,
          ...city.buildingMeshes,
          ...physicsCars.map((c) => c.mesh),
          ...game.enemies.map((e) => e.mesh),
          ...police.copPeds.map((e) => e.mesh),
        ];
        const hit = combat.playerShoot(player.pos, shootables);
        if (hit) {
          audio.gunshot();
          police.addHeat(WANTED.SHOOT_HEAT);
          traffic.scare(player.pos.x, player.pos.z);
          chaseCamera.addShake(0.08);
          if (hit.type === 'enemy' && hit.died) {
            game.money += 25;
            audio.pickup();
            hud.showToast('Target down. +$25');
          }
        }
      }
    }

    combat.update(dt);
    effects.update(dt);
    police.update(
      dt,
      player.pos,
      player.heading,
      game.driving,
      game.playerCar,
      player,
      effects,
      hud,
      busted,
      game.time,
      physicsCars,
    );

    // Mission enemies shoot back (spawned by the missions module).
    for (let i = game.enemies.length - 1; i >= 0; i--) {
      const enemy = game.enemies[i];
      const done = enemy.update(dt, player.pos, player, effects, () => {
        hud.flashDamage();
        chaseCamera.addShake(0.2);
      }, city.colliders, game.time);
      if (done) {
        enemy.remove();
        game.enemies.splice(i, 1);
      }
    }

    // Missions drive the objective, the beacon and the story.
    missions.update(dt, player.pos, game.driving, game.playerCar);
    game.objective = missions.objective;
    game.missionName = missions.done
      ? 'Story complete — free roam'
      : missions.active
        ? `${missions.index + 1}. ${missions.current.title}`
        : 'Palmar Bay';
    game.missionBlip = missions.blip;

    if (player.health <= 0) wasted();

    chaseCamera.update(
      dt,
      input,
      player.pos,
      game.driving ? game.playerCar.heading : player.heading,
      game.driving,
      game.playerCar ? Math.min(1, Math.abs(game.playerCar.speed) / 46) : 0,
    );
    // A screenshot preset may place its own camera for the frame.
    shotDriver?.afterCamera?.();
    city.update(dt, game.time);
    audio.update(dt, {
      driving: game.driving,
      speed01: game.playerCar ? Math.min(1, Math.abs(game.playerCar.speed) / 46) : 0,
      siren: police.sirenOn,
    });

    autosaveTimer += dt;
    if (autosaveTimer > 15) {
      autosaveTimer = 0;
      saveGame();
    }

    game.health = player.health;
    game.traffic = traffic.allCars().map((c) => ({ x: c.pos.x, z: c.pos.z }));
    game.police = police.cars.map((p) => ({ x: p.car.pos.x, z: p.car.pos.z }));
    hud.update(dt, {
      money: game.money,
      health: game.health,
      wanted: police.wanted,
      driving: game.driving,
      speedMph: game.speedMph,
      objective: game.objective,
      missionName: game.missionName,
      playerX: player.pos.x,
      playerZ: player.pos.z,
      playerHeading: player.heading,
      missionBlip: game.missionBlip,
      traffic: game.traffic,
      police: game.police,
    });
    hud.setCrosshair(!game.driving);
  }

  input.endFrame();
  renderer.render(scene, camera);
  window.__game.errors = errors;
});
