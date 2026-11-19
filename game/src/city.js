// Palmar Bay — the city itself: the painted ground, the skyline, the palms,
// the lamps, the pier and the sea. Everything is placed from one seed, so
// the streets the missions name are the same streets the traffic drives.

import * as THREE from 'three';
import { WORLD, CITY_HALF, DAY } from './config.js';
import {
  buildGroundTexture,
  buildFacadeTextures,
  buildWaterTexture,
  buildSkyTexture,
  buildSignTexture,
  GROUND_SIZE,
  GROUND_CENTER_Z,
} from './textures.js';

// Named places the missions, the HUD and the minimap all share.
export const LOCATIONS = {
  cafe: { x: -87, z: -29, name: "Rosa's Cafe" },
  hotel: { x: 87, z: -145, name: 'Hotel Miramar' },
  garage: { x: -145, z: 87, name: "Diz's Garage" },
  alley: { x: 29, z: 145, name: 'The Alley' },
  pier: { x: -120, z: 312, name: 'The Pier' },
  bank: { x: 29, z: -87, name: 'Palmar Bay Bank' },
  safehouse: { x: 203, z: 203, name: 'Safehouse' },
  hideout: { x: -203, z: -203, name: 'Viper Hideout' },
  hospital: { x: 145, z: 29, name: 'St. Marina Hospital' },
  policeStation: { x: -29, z: -203, name: 'PBPD Central' },
  dealership: { x: 145, z: -29, name: 'Comet Motors' },
};

export function roadCentres() {
  const centres = [];
  for (let i = 0; i < WORLD.GRID - 1; i++) {
    centres.push((i - (WORLD.GRID - 1) / 2) * WORLD.PITCH + WORLD.PITCH / 2);
  }
  return centres;
}

export function isOnRoad(x, z) {
  for (const c of roadCentres()) {
    if (Math.abs(x - c) <= WORLD.ROAD / 2 + 1 || Math.abs(z - c) <= WORLD.ROAD / 2 + 1) return true;
  }
  return false;
}

// Snap a point to the nearest road centre line.
export function nearestRoadPoint(x, z) {
  const centres = roadCentres();
  let best = null;
  let bestDist = Infinity;
  for (const c of centres) {
    const dx = Math.abs(x - c);
    if (dx < bestDist) {
      bestDist = dx;
      best = { x: c, z, axis: 'z' };
    }
    const dz = Math.abs(z - c);
    if (dz < bestDist) {
      bestDist = dz;
      best = { x, z: c, axis: 'x' };
    }
  }
  return best;
}

export function randomRoadPoint(rng) {
  const centres = roadCentres();
  const c = rng.pick(centres);
  const along = rng.range(-CITY_HALF, CITY_HALF);
  if (rng.chance(0.5)) return { x: c, z: along, axis: 'z' };
  return { x: along, z: c, axis: 'x' };
}

export function buildCity(scene, rng) {
  const colliders = [];
  const waterMeshes = [];

  // Sky dome: a big sphere with a painted sunset gradient, seen from inside.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({
      map: buildSkyTexture(DAY.SKY_TOP, DAY.SKY_HORIZON),
      side: THREE.BackSide,
      fog: false,
    }),
  );
  scene.add(sky);

  // Sun: one warm directional light with shadows, plus a hemisphere fill.
  const sunAngle = (DAY.SUN_AZIMUTH * Math.PI) / 180;
  const sunElev = (DAY.SUN_ELEVATION * Math.PI) / 180;
  const sun = new THREE.DirectionalLight(DAY.SUN_COLOR, DAY.SUN_INTENSITY);
  sun.position.set(
    Math.cos(sunElev) * Math.sin(sunAngle) * 300,
    Math.sin(sunElev) * 300,
    Math.cos(sunElev) * Math.cos(sunAngle) * 300,
  );
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(DAY.HEMI_SKY, DAY.HEMI_GROUND, DAY.HEMI_INTENSITY);
  scene.add(hemi);
  scene.fog = new THREE.Fog(DAY.FOG_COLOR, DAY.FOG_NEAR, DAY.FOG_FAR);

  // Ground: one painted plane for the whole city, beach and sea floor.
  const groundTexture = buildGroundTexture();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
    new THREE.MeshLambertMaterial({ map: groundTexture }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, GROUND_CENTER_Z);
  ground.receiveShadow = true;
  ground.userData.building = true;
  scene.add(ground);

  // Sea: a translucent animated plane over the painted water.
  const waterTexture = buildWaterTexture();
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE - (WORLD.WATER_Z - GROUND_CENTER_Z) - GROUND_SIZE / 2 + 44),
    new THREE.MeshLambertMaterial({ map: waterTexture, transparent: true, opacity: 0.85 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.12, WORLD.WATER_Z + 22);
  water.scale.set(1, 1, 1);
  scene.add(water);
  waterMeshes.push(water);

  // Buildings: three instanced meshes, one per facade variant.
  const facadeTextures = buildFacadeTextures();
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  boxGeometry.translate(0, 0.5, 0);
  const buildingMeshes = facadeTextures.map((texture) => {
    const material = new THREE.MeshLambertMaterial({ map: texture });
    const mesh = new THREE.InstancedMesh(boxGeometry, material, 320);
    mesh.count = 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.building = true;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    scene.add(mesh);
    return mesh;
  });
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  const counts = [0, 0, 0];

  function addBuilding(x, z, w, d, h) {
    const variant = Math.floor(rng.next() * 3);
    const mesh = buildingMeshes[variant];
    const i = counts[variant]++;
    position.set(x, 0, z);
    scale.set(w, h, d);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }

  // Lay out the blocks. Downtown towers in the middle, low blocks outside,
  // the centre block kept open as the plaza, the beach rows left bare.
  for (let i = 0; i < WORLD.GRID; i++) {
    for (let j = 0; j < WORLD.GRID; j++) {
      const cx = (i - (WORLD.GRID - 1) / 2) * WORLD.PITCH;
      const cz = (j - (WORLD.GRID - 1) / 2) * WORLD.PITCH;
      if (cz + WORLD.BLOCK / 2 > WORLD.BEACH_Z) continue;
      if (i === 4 && j === 4) continue; // the plaza
      const downtown = Math.abs(i - 4) <= 1 && Math.abs(j - 4) <= 1;
      if (downtown) {
        addBuilding(cx, cz, rng.range(26, 32), rng.range(26, 32), rng.range(34, 68));
      } else if (rng.chance(0.18)) {
        // A parking lot: no building, a few parked cars appear here instead.
        continue;
      } else if (rng.chance(0.5)) {
        addBuilding(cx, cz, rng.range(24, 30), rng.range(24, 30), rng.range(10, 22));
      } else {
        // Two smaller buildings side by side.
        addBuilding(cx - 11, cz, rng.range(15, 19), rng.range(18, 24), rng.range(8, 18));
        addBuilding(cx + 11, cz, rng.range(15, 19), rng.range(18, 24), rng.range(8, 18));
      }
    }
  }
  buildingMeshes.forEach((mesh, v) => {
    mesh.count = counts[v];
    mesh.instanceMatrix.needsUpdate = true;
  });

  // Palms: instanced trunks and leaf crowns along the beach and the avenues.
  const trunkGeometry = new THREE.CylinderGeometry(0.22, 0.34, 7, 6);
  trunkGeometry.translate(0, 3.5, 0);
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8a6b45 });
  const palmPositions = [];
  for (let x = -260; x <= 260; x += 13) {
    palmPositions.push([x + rng.range(-2, 2), WORLD.BEACH_Z + 4 + rng.range(0, 4)]);
  }
  for (let i = 0; i < 40; i++) {
    const p = randomRoadPoint(rng);
    const side = rng.chance(0.5) ? 1 : -1;
    if (p.axis === 'z') palmPositions.push([p.x + side * (WORLD.ROAD / 2 + 2.5), p.z]);
    else palmPositions.push([p.x, p.z + side * (WORLD.ROAD / 2 + 2.5)]);
  }
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, palmPositions.length);
  const leafGeometry = new THREE.ConeGeometry(2.6, 2.2, 7);
  leafGeometry.translate(0, 7.6, 0);
  const leafMaterial = new THREE.MeshLambertMaterial({ color: 0x2f7a3d });
  const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, palmPositions.length);
  palmPositions.forEach(([x, z], i) => {
    const lean = rng.range(-0.08, 0.08);
    quaternion.setFromEuler(new THREE.Euler(lean, rng.range(0, Math.PI * 2), lean));
    position.set(x, 0, z);
    scale.set(1, rng.range(0.85, 1.25), 1);
    matrix.compose(position, quaternion, scale);
    trunks.setMatrixAt(i, matrix);
    leaves.setMatrixAt(i, matrix);
  });
  trunks.castShadow = true;
  scene.add(trunks);
  scene.add(leaves);

  // Street lamps at the intersections.
  const poleGeometry = new THREE.CylinderGeometry(0.09, 0.12, 6, 5);
  poleGeometry.translate(0, 3, 0);
  const poleMaterial = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
  const lampGeometry = new THREE.SphereGeometry(0.28, 8, 6);
  lampGeometry.translate(0, 6.1, 0);
  const lampMaterial = new THREE.MeshLambertMaterial({
    color: 0xfff2c0,
    emissive: 0xffdf8a,
    emissiveIntensity: 0.9,
  });
  const lampSpots = [];
  for (const c of roadCentres()) {
    for (const d of roadCentres()) {
      lampSpots.push([c + WORLD.ROAD / 2 + 1, d + WORLD.ROAD / 2 + 1]);
    }
  }
  const poles = new THREE.InstancedMesh(poleGeometry, poleMaterial, lampSpots.length);
  const lamps = new THREE.InstancedMesh(lampGeometry, lampMaterial, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    quaternion.identity();
    position.set(x, 0, z);
    scale.set(1, 1, 1);
    matrix.compose(position, quaternion, scale);
    poles.setMatrixAt(i, matrix);
    lamps.setMatrixAt(i, matrix);
  });
  scene.add(poles);
  scene.add(lamps);

  // The pier: wooden planks out into the sea, with a little boat at the end.
  const pierMaterial = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 62), pierMaterial);
  pier.position.set(LOCATIONS.pier.x, 0.4, WORLD.BEACH_Z + 30);
  pier.castShadow = true;
  pier.receiveShadow = true;
  scene.add(pier);
  colliders.push({
    minX: LOCATIONS.pier.x - 5,
    maxX: LOCATIONS.pier.x + 5,
    minZ: WORLD.BEACH_Z,
    maxZ: WORLD.BEACH_Z + 62,
  });
  const boatMaterial = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, 10), boatMaterial);
  hull.position.y = 0.4;
  boat.add(hull);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(3, 1.6, 4),
    new THREE.MeshLambertMaterial({ color: 0x2e6f8e }),
  );
  cabin.position.set(0, 1.8, -1);
  boat.add(cabin);
  boat.position.set(LOCATIONS.pier.x + 9, 0.1, WORLD.BEACH_Z + 58);
  scene.add(boat);

  // The plaza: a fountain at its centre, so the open block has a focal
  // point instead of an empty lawn.
  const fountainRim = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.8, 0.9, 20),
    new THREE.MeshLambertMaterial({ color: 0xcfc8b8 }),
  );
  fountainRim.position.set(0, 0.45, 0);
  fountainRim.castShadow = true;
  fountainRim.receiveShadow = true;
  scene.add(fountainRim);
  const fountainWater = new THREE.Mesh(
    new THREE.CylinderGeometry(3.9, 3.9, 0.2, 20),
    new THREE.MeshLambertMaterial({ color: 0x4a90c2 }),
  );
  fountainWater.position.set(0, 0.85, 0);
  scene.add(fountainWater);
  const fountainJet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.8, 2.2, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8d2c2 }),
  );
  fountainJet.position.set(0, 1.6, 0);
  scene.add(fountainJet);
  colliders.push({ minX: -5, maxX: 5, minZ: -5, maxZ: 5 });

  // Billboards and shop signs: painted textures on plain boards.
  const signs = [
    { text: 'PALMAR BAY', bg: '#e8573f', fg: '#ffffff', x: 0, z: -232, w: 34, h: 9, y: 26 },
    { text: "ROSA'S CAFE", bg: '#2e6f8e', fg: '#ffe9a8', x: -87, z: -58, w: 18, h: 4.5, y: 8 },
    { text: 'HOTEL MIRAMAR', bg: '#f2e6c8', fg: '#2e6f8e', x: 87, z: -174, w: 20, h: 5, y: 12 },
    { text: 'COMET MOTORS', bg: '#22252a', fg: '#ffd27a', x: 145, z: -58, w: 18, h: 4.5, y: 9 },
  ];
  for (const s of signs) {
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(s.w, s.h),
      new THREE.MeshBasicMaterial({ map: buildSignTexture(s.text, s.bg, s.fg) }),
    );
    board.position.set(s.x, s.y, s.z);
    scene.add(board);
  }

  return {
    colliders,
    groundTexture,
    ground,
    buildingMeshes,
    sun,
    update(dt, time) {
      waterTexture.offset.x = time * 0.008;
      waterTexture.offset.y = time * 0.005;
    },
  };
}

// Circle (x, z, radius) against the building colliders: push the circle out
// and report whether it hit anything. Used by the player, cars and peds.
export function resolveCircleColliders(colliders, x, z, radius) {
  let hit = false;
  for (const c of colliders) {
    const closestX = Math.max(c.minX, Math.min(x, c.maxX));
    const closestZ = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - closestX;
    const dz = z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      hit = true;
      const dist = Math.sqrt(distSq) || 0.001;
      const push = (radius - dist) / dist;
      x += dx * push;
      z += dz * push;
    }
  }
  return { x, z, hit };
}
